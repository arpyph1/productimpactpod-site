#!/usr/bin/env python3
"""
Generate a photographic, text-free hero image for a published article.

Pipeline:
  1. Prompt-distillation: Anthropic Claude condenses article title +
     subtitle + meta_description into a short visual concept.
  2. Image generation: Replicate (Flux 1.1 Pro) renders the scene with
     a locked-in style system prompt + negative prompt tuned to avoid
     obvious AI tells.
  3. Upload: Supabase Storage (public bucket 'article-heroes') receives
     the rendered PNG and returns a public URL.
  4. Return: prints the uploaded URL to stdout for publish_articles.py
     to write into articles.hero_image_url.

Design constraints (per editorial brief):
  - Photographic / editorial / documentary style only
  - No text, logos, watermarks, or signage
  - Zero or one person max (prefer zero — avoids uncanny face artefacts)
  - No futuristic / sci-fi aesthetics
  - Avoid common AI tells: extra fingers, warped anatomy, floating objects

Env vars required:
  ANTHROPIC_API_KEY     — for prompt distillation (Claude)
  REPLICATE_API_TOKEN   — for image generation (Flux 1.1 Pro)
  PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY  — service role (bypasses RLS for uploads)

Usage:
  # CLI — reads article JSON from stdin, prints URL to stdout:
  python3 generate_hero_image.py < article.json

  # With explicit output path (skips upload, saves local PNG):
  python3 generate_hero_image.py --file article.json --out /tmp/hero.png

  # From publish_articles.py:
  from generate_hero_image import generate
  url = generate(article_dict)
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

# ── Configuration ───────────────────────────────────────────────────────────

ANTHROPIC_MODEL = "claude-opus-4-6"  # latest, strongest for visual reasoning
REPLICATE_MODEL = "black-forest-labs/flux-1.1-pro"
SUPABASE_BUCKET = "article-heroes"
OUTPUT_WIDTH = 1200
OUTPUT_HEIGHT = 628   # OG social-card aspect; hero_image_url serves both

# Locked editorial style — prepended to every prompt.
# This is intentionally verbose: Flux responds better to descriptive cues
# than to keyword soup.
EDITORIAL_STYLE = (
    "Editorial photograph, documentary photojournalism style, natural "
    "lighting, shallow depth of field, muted colour grade, fine grain. "
    "Shot on a 35mm prime lens. Composition follows rule of thirds. "
    "Analogue, understated, restrained."
)

# Negative prompt — what Flux should avoid.
NEGATIVE = (
    "text, letters, numbers, logos, watermarks, signage, captions, "
    "subtitles, futuristic, sci-fi, cyberpunk, neon, holographic, "
    "robotic, android, cyborg, glowing elements, lens flare, HDR, "
    "oversaturated, cartoon, illustration, 3D render, CGI, painting, "
    "anime, stylised, multiple people, crowd, group, extra fingers, "
    "extra limbs, distorted anatomy, deformed hands, blurry faces, "
    "low quality, artefacts, JPEG compression, uncanny"
)


@dataclass
class GenerateResult:
    prompt: str
    image_url: str        # public URL (Supabase Storage) or local path
    model: str
    elapsed_s: float


# ── Prompt distillation ─────────────────────────────────────────────────────

def _distill_prompt(article: dict, *, api_key: str) -> str:
    """Ask Claude to condense the article into a short photographic concept.

    Deliberately keeps output to one sentence — Flux does better with
    specific-but-concise scene descriptions than long paragraphs.
    """
    title = article.get("title", "").strip()
    subtitle = article.get("subtitle", "") or ""
    meta_desc = article.get("meta_description", "") or ""
    first_theme = (article.get("themes") or ["ai-product-strategy"])[0]

    system = (
        "You distill news article headers into short photographic concepts "
        "for a hero image. Output ONE sentence describing what to photograph. "
        "\n\nHard rules:\n"
        "- PHOTOGRAPHIC subject — real objects, spaces, natural phenomena, "
        "documentary moments. No abstractions.\n"
        "- Prefer scenes with NO people. If the article's about a person, "
        "photograph their workspace / tool / environment instead.\n"
        "- NEVER include: futuristic scenes, sci-fi, robots, screens with "
        "readable content, text, logos, signage, or crowds.\n"
        "- Concrete nouns + lighting/setting adjective. ~15 words.\n"
        "- Output ONLY the sentence. No preamble, no quotes."
    )

    user = (
        f"Article title: {title}\n"
        f"Subtitle: {subtitle}\n"
        f"Meta description: {meta_desc}\n"
        f"Primary theme: {first_theme}\n\n"
        "Describe the hero photograph."
    )

    body = json.dumps({
        "model": ANTHROPIC_MODEL,
        "max_tokens": 100,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        method="POST",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    # Response shape: { content: [{ type: "text", text: "..." }] }
    blocks = data.get("content", [])
    text_blocks = [b.get("text", "") for b in blocks if b.get("type") == "text"]
    distilled = " ".join(text_blocks).strip()
    # Strip any accidental quote marks
    distilled = re.sub(r'^["\']|["\']$', "", distilled).strip()
    if not distilled:
        raise RuntimeError("Claude returned empty distilled prompt")
    return distilled


def _build_full_prompt(subject: str) -> str:
    """Combine distilled subject with the locked editorial style."""
    return f"{subject}. {EDITORIAL_STYLE}"


# ── Image generation ────────────────────────────────────────────────────────

def _generate_image(prompt: str, *, replicate_token: str) -> bytes:
    """Call Replicate's Flux 1.1 Pro. Polls prediction until complete."""
    create_body = json.dumps({
        "input": {
            "prompt": prompt,
            "negative_prompt": NEGATIVE,
            "aspect_ratio": "16:9",       # close to 1200×628 OG (1.91:1)
            "output_format": "png",
            "output_quality": 95,
            "safety_tolerance": 2,
            "prompt_upsampling": False,   # keep our prompt as-authored
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions",
        data=create_body,
        method="POST",
        headers={
            "Authorization": f"Bearer {replicate_token}",
            "Content-Type": "application/json",
            "Prefer": "wait=60",  # block up to 60s so we may skip polling
        },
    )

    with urllib.request.urlopen(req, timeout=90) as resp:
        prediction = json.loads(resp.read())

    # If not yet complete, poll
    get_url = prediction.get("urls", {}).get("get")
    deadline = time.time() + 180
    while prediction.get("status") not in ("succeeded", "failed", "canceled"):
        if time.time() > deadline:
            raise RuntimeError(f"image generation timed out: {prediction.get('status')}")
        time.sleep(2)
        poll = urllib.request.Request(
            get_url,
            headers={"Authorization": f"Bearer {replicate_token}"},
        )
        with urllib.request.urlopen(poll, timeout=30) as r:
            prediction = json.loads(r.read())

    if prediction.get("status") != "succeeded":
        raise RuntimeError(
            f"image generation failed: {prediction.get('error') or prediction.get('status')}"
        )

    output = prediction.get("output")
    # Flux returns a string URL or list of URLs depending on model version
    image_url = output if isinstance(output, str) else output[0]

    # Download the generated PNG
    with urllib.request.urlopen(image_url, timeout=60) as r:
        return r.read()


# ── Supabase upload ─────────────────────────────────────────────────────────

def _upload_to_supabase(
    png_bytes: bytes,
    object_name: str,
    *,
    supabase_url: str,
    service_key: str,
) -> str:
    """Upload to public bucket, return the public CDN URL."""
    # Ensure object path is URL-safe
    safe_name = urllib.parse.quote(object_name, safe="/-")
    upload_url = f"{supabase_url}/storage/v1/object/{SUPABASE_BUCKET}/{safe_name}"

    req = urllib.request.Request(
        upload_url,
        data=png_bytes,
        method="POST",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "image/png",
            "x-upsert": "true",   # overwrite if regenerating for an existing slug
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status not in (200, 201):
                raise RuntimeError(f"upload returned {resp.status}")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase upload HTTP {e.code}: {err}")

    return f"{supabase_url}/storage/v1/object/public/{SUPABASE_BUCKET}/{safe_name}"


# ── Public API ──────────────────────────────────────────────────────────────

def generate(
    article: dict,
    *,
    out_path: str | None = None,
    anthropic_key: str | None = None,
    replicate_token: str | None = None,
    supabase_url: str | None = None,
    supabase_service_key: str | None = None,
) -> GenerateResult:
    """End-to-end: distill → render → upload (or save locally).

    If `out_path` is given, the PNG is saved there and no Supabase upload
    happens (useful for human review before committing to publish).
    """
    anthropic_key = anthropic_key or os.environ.get("ANTHROPIC_API_KEY")
    replicate_token = replicate_token or os.environ.get("REPLICATE_API_TOKEN")
    supabase_url = supabase_url or os.environ.get("PUBLIC_SUPABASE_URL") \
        or "https://cyqkfkvsrdbbjuaqiglx.supabase.co"
    supabase_service_key = supabase_service_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not anthropic_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    if not replicate_token:
        raise RuntimeError("REPLICATE_API_TOKEN not set")

    slug = article.get("slug")
    if not slug:
        raise RuntimeError("article.slug required for hero image object path")

    t0 = time.time()
    subject = _distill_prompt(article, api_key=anthropic_key)
    full_prompt = _build_full_prompt(subject)
    png = _generate_image(full_prompt, replicate_token=replicate_token)

    if out_path:
        with open(out_path, "wb") as fh:
            fh.write(png)
        image_url = out_path
    else:
        if not supabase_service_key:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY not set — required for upload "
                "(or pass --out to save locally for review)"
            )
        image_url = _upload_to_supabase(
            png,
            object_name=f"{slug}.png",
            supabase_url=supabase_url,
            service_key=supabase_service_key,
        )

    return GenerateResult(
        prompt=full_prompt,
        image_url=image_url,
        model=REPLICATE_MODEL,
        elapsed_s=round(time.time() - t0, 1),
    )


# ── CLI ─────────────────────────────────────────────────────────────────────

def _main(argv: list[str]) -> int:
    source = "stdin"
    out_path: str | None = None

    if "--out" in argv:
        idx = argv.index("--out")
        if idx + 1 >= len(argv):
            print("Usage: generate_hero_image.py [--file PATH] [--out PATH]", file=sys.stderr)
            return 2
        out_path = argv[idx + 1]

    if "--file" in argv:
        idx = argv.index("--file")
        path = argv[idx + 1]
        with open(path, "r", encoding="utf-8") as fh:
            raw = fh.read()
        source = path
    else:
        raw = sys.stdin.read()

    try:
        article = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"✗ {source}: invalid JSON — {e}", file=sys.stderr)
        return 2

    try:
        result = generate(article, out_path=out_path)
    except Exception as e:
        print(f"✗ generation failed: {e}", file=sys.stderr)
        return 1

    # Primary output: the URL goes to stdout so pipelines can capture it
    print(result.image_url)
    print(
        f"  prompt: {result.prompt}\n"
        f"  model:  {result.model}\n"
        f"  took:   {result.elapsed_s}s",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))

# Publishing pipeline — tools for `publish_articles.py`

This directory holds three standalone scripts that your vault-side
`publish_articles.py` should call (either as subprocesses, or by
importing them as Python modules).

They're kept in the site repo so the site and its publishing tools share
one source of truth for:
- canonical theme slugs and article formats (`validate_article.py`)
- the exact dispatch repo + event type (`dispatch_rebuild.py`)
- the image style system prompt and model config (`generate_hero_image.py`)

When these constants change, the publisher gets the update automatically
on the next `git pull` of this repo.

---

## 1. `validate_article.py` — pre-publish check

Runs **before** the INSERT into Supabase. Blocks publishes that would
break SEO, Google News indexing, or the Astro build.

### Subprocess usage

```python
import json, subprocess
proc = subprocess.run(
    ["python3", "scripts/publishing/validate_article.py"],
    input=json.dumps(article).encode("utf-8"),
    capture_output=True,
)
if proc.returncode != 0:
    raise RuntimeError(proc.stderr.decode())
```

### Module import usage

```python
sys.path.insert(0, "path/to/productimpactpod-site/scripts/publishing")
from validate_article import validate, has_errors

issues = validate(article)
if has_errors(issues):
    for i in issues: print(i)
    raise ValueError(f"Article {article['slug']!r} failed validation")
```

### What it checks

- **Required fields**: `slug`, `title`, `meta_description`, `format`,
  `themes`, `canonical_url`, `author_slugs`, `publish_date`, content
- **Slug shape**: lowercase hyphenated alphanumerics, reasonable length
- **Format enum**: must be one of the 10 canonical formats
- **Themes**: must be in the canonical 8; 1–3 assigned
- **Canonical URL**: must point to `https://productimpactpod.com/news/{slug}`
- **Meta description**: 120–170 chars (Google News truncation bounds)
- **Publish date**: ISO 8601
- **Hero image**: warns if missing; errors if non-absolute URL
- **Overview bullets**: warns if not 3–5
- **Topics**: must be slugs

Errors → exit 1. Warnings are informational and don't block.

---

## 2. `generate_hero_image.py` — AI image generation

Runs after validation, before INSERT. Distills an editorial prompt from
the article, renders a photographic image via Flux 1.1 Pro, uploads to
Supabase Storage, returns the public URL to write into
`articles.hero_image_url`.

### Style commitments baked in

- Documentary photojournalism aesthetic
- No text, logos, signage, watermarks
- Zero or one person (prefers zero; photographs a workspace/object/scene
  instead)
- Actively avoids futuristic / sci-fi / robotic / neon tells
- Negative-prompt blocks extra fingers, uncanny anatomy, CGI look

### Env vars required

```
ANTHROPIC_API_KEY            # Claude (prompt distillation)
REPLICATE_API_TOKEN          # Flux 1.1 Pro (image rendering)
PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY    # bypasses RLS; needed for Storage upload
```

### Subprocess usage

```python
proc = subprocess.run(
    ["python3", "scripts/publishing/generate_hero_image.py"],
    input=json.dumps(article).encode("utf-8"),
    capture_output=True,
    check=True,
)
# The public URL is the first line of stdout
hero_url = proc.stdout.decode().splitlines()[0].strip()
article["hero_image_url"] = hero_url
```

### Module import usage

```python
from generate_hero_image import generate
result = generate(article)
article["hero_image_url"] = result.image_url
article["hero_image_alt"] = f"Editorial photograph: {article['title']}"
```

### Review-before-publish mode

Pass `--out /path/to/file.png` (CLI) or `out_path=...` (Python) to skip
the upload and save the PNG locally. Useful when you want a human to eyeball
the generated image before committing to publish.

### Cost / performance

- Flux 1.1 Pro: ~$0.04/image, usually returns within 15–30 s
- Claude distillation: 100 output tokens, pennies
- Total per article: ~$0.05 and ~30 s

### Supabase Storage setup (one-time)

```sql
-- Create the public bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-heroes', 'article-heroes', true)
ON CONFLICT DO NOTHING;

-- Permit anonymous reads (bucket is public — this policy just makes it
-- explicit for defence in depth)
CREATE POLICY "Anon can read article heroes"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'article-heroes');
```

---

## 3. `dispatch_rebuild.py` — trigger Cloudflare rebuild

Runs after a successful publish (or batch of publishes). Tells GitHub
Actions to ping the Cloudflare Pages deploy hook, which rebuilds the
static site with fresh Supabase data.

### Env var required

```
GITHUB_TOKEN    # a PAT with 'repo' scope on arpyph1/productimpactpod-site
                # (or GH_TOKEN as fallback)
```

### Usage

```python
import subprocess, json
subprocess.run([
    "python3", "scripts/publishing/dispatch_rebuild.py",
    "--payload", json.dumps({"articleSlug": article["slug"]}),
], check=True)
```

The payload is optional and visible in the GitHub Actions run log for
debugging. `.github/workflows/publish-trigger.yml` listens for
`repository_dispatch` events of type `content-published` and curls the
Cloudflare deploy hook stored as the `CF_DEPLOY_HOOK_URL` secret.

### Batch publishes

For a multi-article publish, call `dispatch_rebuild.py` **once at the
end**, not once per article. CF Pages queues one build regardless of how
many times the deploy hook is hit in quick succession, but you save API
calls and keep the GitHub Actions log clean.

---

## Recommended flow in `publish_articles.py`

```python
def publish_article(markdown_path):
    article = parse_vault_markdown(markdown_path)       # your existing parser

    # 1. Pre-flight check
    from validate_article import validate, has_errors
    issues = validate(article)
    if has_errors(issues):
        for i in issues: log.error(str(i))
        raise ValueError(f"{article['slug']} blocked by validation")
    for w in (i for i in issues if i.severity == "warn"):
        log.warning(str(w))

    # 2. Hero image (only if not already set)
    if not article.get("hero_image_url"):
        from generate_hero_image import generate
        result = generate(article)
        article["hero_image_url"] = result.image_url
        article["hero_image_alt"] = f"Editorial photograph: {article['title']}"
        article["hero_image_credit"] = "Generated via Flux 1.1 Pro"

    # 3. Write to Supabase
    supabase.table("articles").upsert(article, on_conflict="slug").execute()

    # 4. Link entities (if your vault has entity references)
    link_entities_to_article(article)   # your existing function

def publish_batch(markdown_paths):
    for path in markdown_paths:
        publish_article(path)

    # 5. Trigger a single site rebuild after the batch
    from dispatch_rebuild import dispatch
    ok, msg = dispatch({"count": len(markdown_paths)})
    if not ok: log.warning(f"rebuild dispatch failed: {msg}")
```

---

## Testing locally without publishing

```bash
# Dry-run the validator against a fixture
cat tests/fixtures/valid-article.json | python3 validate_article.py

# Generate an image to a local path (no Supabase upload, no publish)
cat tests/fixtures/valid-article.json | \
  python3 generate_hero_image.py --out /tmp/hero.png

# Test the dispatch trigger (must not run in production without GH_TOKEN set)
GITHUB_TOKEN=$(gh auth token) python3 dispatch_rebuild.py
```

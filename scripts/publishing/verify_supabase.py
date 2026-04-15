#!/usr/bin/env python3
"""
Pre-publish environment check for the Product Impact Supabase project.

Run this ONCE before first publish (and after any schema changes) to
verify the Astro site's expectations are met. Reports every missing
table, broken RLS policy, and unset env var without making any writes.

Usage:
  python3 verify_supabase.py
  python3 verify_supabase.py --verbose

Exit code: 0 if everything is ready, 1 otherwise.

Env vars required:
  PUBLIC_SUPABASE_URL         (default: hard-coded fallback)
  PUBLIC_SUPABASE_ANON_KEY    (for anon-read checks)

Optional (extends checks):
  SUPABASE_SERVICE_ROLE_KEY   (enables Storage bucket check)
  ANTHROPIC_API_KEY           (checks key is set, doesn't call API)
  REPLICATE_API_TOKEN         (checks key is set)
  CF_DEPLOY_HOOK_URL          (checks format; doesn't fire the hook)
  GITHUB_TOKEN                (checks token is set)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

DEFAULT_SUPABASE_URL = "https://cyqkfkvsrdbbjuaqiglx.supabase.co"

CANONICAL_THEMES = {
    "ai-product-strategy",
    "agents-agentic-systems",
    "ux-experience-design-for-ai",
    "adoption-organizational-change",
    "evaluation-benchmarking",
    "go-to-market-distribution",
    "data-semantics-knowledge-foundations",
    "governance-risk-trust",
}

REQUIRED_HOST_SLUGS = {"arpy-dragffy", "brittany-hobbs"}


@dataclass
class Check:
    name: str
    ok: bool
    message: str
    hint: str = ""

    def render(self, verbose: bool = False) -> str:
        mark = "✓" if self.ok else "✗"
        line = f"  {mark} {self.name}: {self.message}"
        if not self.ok and self.hint:
            line += f"\n      hint: {self.hint}"
        return line


@dataclass
class Section:
    title: str
    checks: list[Check] = field(default_factory=list)

    def add(self, c: Check) -> None:
        self.checks.append(c)

    @property
    def ok(self) -> bool:
        return all(c.ok for c in self.checks)


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def _rest_get(base: str, path: str, anon_key: str, params: dict | None = None) -> tuple[int, Any]:
    """GET against Supabase REST (PostgREST). Returns (status, parsed JSON or error str)."""
    q = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{base}/rest/v1/{path.lstrip('/')}{q}"
    req = urllib.request.Request(
        url,
        headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read()
            try:
                return resp.status, json.loads(body)
            except Exception:
                return resp.status, body.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body
    except urllib.error.URLError as e:
        return 0, str(e)


# ── Individual checks ────────────────────────────────────────────────────────

def check_env() -> Section:
    s = Section("Environment variables")
    url = os.environ.get("PUBLIC_SUPABASE_URL", DEFAULT_SUPABASE_URL)
    anon = os.environ.get("PUBLIC_SUPABASE_ANON_KEY", "")

    s.add(Check(
        "PUBLIC_SUPABASE_URL",
        bool(url),
        url or "(missing)",
        hint="export PUBLIC_SUPABASE_URL=…",
    ))
    s.add(Check(
        "PUBLIC_SUPABASE_ANON_KEY",
        bool(anon),
        f"set ({len(anon)} chars)" if anon else "(missing)",
        hint="Required for RLS anon-read checks. Copy from .env.example.",
    ))

    # Publisher-only secrets — informational, not blocking if you only run
    # the site side
    for name, required_for in [
        ("SUPABASE_SERVICE_ROLE_KEY", "Storage uploads in generate_hero_image.py"),
        ("ANTHROPIC_API_KEY",         "generate_hero_image.py"),
        ("REPLICATE_API_TOKEN",       "generate_hero_image.py"),
        ("GITHUB_TOKEN",              "dispatch_rebuild.py"),
        ("CF_DEPLOY_HOOK_URL",        "(informational — only needed in GitHub Actions secrets)"),
    ]:
        v = os.environ.get(name)
        s.add(Check(
            name,
            True,       # never block on these — warn via hint
            f"set ({len(v)} chars)" if v else "(not set — optional)",
            hint="" if v else f"required for: {required_for}",
        ))
    return s


def check_rest_tables(base: str, anon: str) -> Section:
    s = Section("Supabase tables (REST / RLS anon reads)")

    tables_required = [
        # (table, filter, hint_if_missing)
        ("articles",        {"select": "slug,title", "published": "eq.true", "limit": "1"},
         "Primary content table. See docs/supabase-schema.md for DDL."),
        ("entities",        {"select": "slug,type,name", "limit": "1"},
         "Entity hub table. Should contain arpy-dragffy and brittany-hobbs at minimum."),
        ("article_entities", {"select": "article_id,entity_id,relevance", "limit": "1"},
         "Join table. Must exist for article sidebars to render entity mentions."),
        ("themes",          {"select": "slug,name", "limit": "1"},
         "Can be empty — site falls back to src/lib/themes.ts canonicalThemes."),
        ("shownotes",       {"select": "episode_guid,title", "published": "eq.true", "limit": "1"},
         "Podcast episodes. Empty is fine — /episodes will just render empty state."),
    ]

    for table, params, hint in tables_required:
        status, data = _rest_get(base, table, anon, params)
        if status == 200 and isinstance(data, list):
            count_label = f"{len(data)} row accessible" if data else "table exists (no rows or RLS-filtered empty)"
            s.add(Check(table, True, count_label))
        elif status == 404:
            s.add(Check(table, False, "HTTP 404 — table does not exist", hint=hint))
        elif status == 401 or status == 403:
            s.add(Check(table, False, f"HTTP {status} — RLS is blocking anon SELECT",
                        hint="Add a SELECT policy for role 'anon'. See docs/supabase-schema.md."))
        elif status == 0:
            s.add(Check(table, False, f"Connection failed: {data}",
                        hint="Check PUBLIC_SUPABASE_URL and network."))
        else:
            msg = data.get("message", data) if isinstance(data, dict) else str(data)[:100]
            s.add(Check(table, False, f"HTTP {status}: {msg}", hint=hint))
    return s


def check_themes_seed(base: str, anon: str) -> Section:
    """Verify all 8 canonical theme slugs exist (or warn if the table is empty)."""
    s = Section("Theme taxonomy seed")
    status, data = _rest_get(
        base, "themes",
        anon,
        {"select": "slug", "limit": "50"},
    )
    if status != 200 or not isinstance(data, list):
        s.add(Check("themes rows", False, f"Couldn't query themes table (HTTP {status})"))
        return s

    if not data:
        s.add(Check(
            "themes seeded", True,
            "empty — site uses src/lib/themes.ts fallback (acceptable, but no long_form_intro override possible)",
            hint="Seed the 8 canonical slugs to unlock per-theme editorial intros.",
        ))
        return s

    seeded = {row["slug"] for row in data if "slug" in row}
    missing = CANONICAL_THEMES - seeded
    extra = seeded - CANONICAL_THEMES

    if missing:
        s.add(Check("canonical 8 slugs", False,
                    f"missing: {sorted(missing)}",
                    hint="These must match src/lib/themes.ts canonicalThemes."))
    else:
        s.add(Check("canonical 8 slugs", True, f"{len(seeded)} seeded, all canonical"))
    if extra:
        s.add(Check(
            "extra slugs", True,
            f"{sorted(extra)} present but not in canonical set — ignored by site but harmless",
        ))
    return s


def check_host_entities(base: str, anon: str) -> Section:
    """Verify arpy-dragffy and brittany-hobbs person entities exist."""
    s = Section("Host entity rows")
    for slug in sorted(REQUIRED_HOST_SLUGS):
        status, data = _rest_get(
            base, "entities",
            anon,
            {"select": "slug,name", "type": "eq.person", "slug": f"eq.{slug}"},
        )
        if status == 200 and isinstance(data, list) and data:
            s.add(Check(f"/people/{slug}", True, f"found: {data[0].get('name', slug)}"))
        elif status == 200:
            s.add(Check(f"/people/{slug}", False,
                        "not found",
                        hint=f"Seed with: INSERT INTO entities(type, slug, name, …) VALUES ('person', '{slug}', …)"))
        else:
            s.add(Check(f"/people/{slug}", False, f"HTTP {status}",
                        hint="entities table or RLS not ready"))
    return s


def check_storage(base: str, service_key: str | None) -> Section:
    s = Section("Supabase Storage (article-heroes bucket)")
    if not service_key:
        s.add(Check(
            "bucket check",
            True,
            "skipped — set SUPABASE_SERVICE_ROLE_KEY to enable",
            hint="Required for image upload in generate_hero_image.py",
        ))
        return s

    url = f"{base}/storage/v1/bucket/article-heroes"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            is_public = body.get("public") is True
            if is_public:
                s.add(Check("article-heroes bucket", True, "exists and is public"))
            else:
                s.add(Check(
                    "article-heroes bucket", False,
                    "exists but NOT public",
                    hint="Set the bucket to public — heroes are referenced by URL on article pages.",
                ))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            s.add(Check(
                "article-heroes bucket", False,
                "does not exist",
                hint=(
                    "Create in Supabase dashboard → Storage, or via SQL:\n"
                    "      INSERT INTO storage.buckets (id, name, public) "
                    "VALUES ('article-heroes', 'article-heroes', true);"
                ),
            ))
        else:
            s.add(Check("article-heroes bucket", False, f"HTTP {e.code}"))
    except Exception as e:
        s.add(Check("article-heroes bucket", False, str(e)))
    return s


def check_edge_functions(base: str, anon: str) -> Section:
    s = Section("Supabase Edge Functions")
    url = f"{base}/functions/v1/get-latest-short"
    body = json.dumps({"channelId": "UCb1nY02YcJYZZ_XtvcIBcrw", "count": 1}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey": anon,
            "Authorization": f"Bearer {anon}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            if "shorts" in data or "error" in data:
                err = data.get("error")
                if err and "YouTube API key" in str(err):
                    s.add(Check(
                        "get-latest-short", False,
                        "deployed but YOUTUBE_API_KEY secret missing",
                        hint="Supabase dashboard → Edge Functions → Secrets → add YOUTUBE_API_KEY",
                    ))
                elif err:
                    s.add(Check("get-latest-short", True,
                                f"deployed, returns: {err} (informational)"))
                else:
                    s.add(Check(
                        "get-latest-short", True,
                        f"deployed, returned {len(data.get('shorts', []))} shorts + "
                        f"{'mostWatched' if data.get('mostWatched') else 'no mostWatched'}",
                    ))
            else:
                s.add(Check("get-latest-short", True, "deployed (unknown response shape)"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            s.add(Check(
                "get-latest-short", False,
                "HTTP 404 — function not deployed on this project",
                hint="Deploy from the Lovable repo: supabase/functions/get-latest-short/",
            ))
        else:
            body = e.read().decode("utf-8", errors="replace")
            s.add(Check("get-latest-short", False, f"HTTP {e.code}: {body[:150]}"))
    except Exception as e:
        s.add(Check("get-latest-short", False, str(e)))
    return s


# ── CLI ─────────────────────────────────────────────────────────────────────

def _main(argv: list[str]) -> int:
    verbose = "--verbose" in argv or "-v" in argv

    base = os.environ.get("PUBLIC_SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    anon = os.environ.get("PUBLIC_SUPABASE_ANON_KEY", "")
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    print(f"Verifying {base}…\n")

    sections: list[Section] = []
    sections.append(check_env())

    if not anon:
        print("\n".join(c.render(verbose) for c in sections[0].checks))
        print("\n✗ Cannot continue without PUBLIC_SUPABASE_ANON_KEY", file=sys.stderr)
        return 1

    sections.append(check_rest_tables(base, anon))
    sections.append(check_themes_seed(base, anon))
    sections.append(check_host_entities(base, anon))
    sections.append(check_storage(base, service))
    sections.append(check_edge_functions(base, anon))

    all_ok = True
    for s in sections:
        print(f"\n{s.title}")
        for c in s.checks:
            print(c.render(verbose))
        if not s.ok:
            all_ok = False

    print("\n" + ("✓ All checks passed — site is ready to publish." if all_ok else "✗ Some checks failed. Address the hints above before first publish."))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))

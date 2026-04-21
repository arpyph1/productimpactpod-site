#!/usr/bin/env python3
"""
Pre-publish validator for Product Impact articles.

Called by publish_articles.py BEFORE writing to Supabase. Blocks publishes
that would break SEO, Google News indexing, or the Astro build.

Usage:
  # As a CLI (reads JSON article record from stdin or a file):
  python3 validate_article.py < article.json
  python3 validate_article.py --file article.json

  # As a Python module from publish_articles.py:
  from validate_article import validate
  errors = validate(article_dict)
  if errors: raise ValueError(...)

Returns exit code 0 on success, 1 on any validation failure.
Prints errors to stderr (one per line, prefixed by severity).
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from typing import Any

# ── Canonical enumerations ──────────────────────────────────────────────────
# These are the authoritative values — they must match:
#   src/lib/themes.ts (canonicalThemes)
#   src/lib/supabase.ts (ArticleFormat)
#   public/llms.txt

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

VALID_FORMATS = {
    "news-brief",
    "news-analysis",
    "release-note",
    "feature",
    "data-reports",
    "case-study",
    "opinion",
    "explainer",
    "product-review",
    "research-brief",
}

CANONICAL_DOMAIN = "https://productimpactpod.com"
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# ── Severity ────────────────────────────────────────────────────────────────

@dataclass
class Issue:
    severity: str          # "error" blocks publish; "warn" is informational
    field: str
    message: str

    def __str__(self) -> str:
        prefix = "✗" if self.severity == "error" else "⚠"
        return f"{prefix} [{self.field}] {self.message}"


# ── Individual checks ───────────────────────────────────────────────────────

def _check_slug(article: dict) -> list[Issue]:
    issues: list[Issue] = []
    slug = article.get("slug", "")
    if not slug:
        issues.append(Issue("error", "slug", "missing — articles require a URL slug"))
    elif not SLUG_PATTERN.match(slug):
        issues.append(Issue(
            "error", "slug",
            f"{slug!r} must be lowercase, hyphen-separated alphanumerics only"
        ))
    elif len(slug) > 100:
        issues.append(Issue(
            "warn", "slug",
            f"{len(slug)} chars — very long slugs hurt shareability; aim for ≤60"
        ))
    return issues


def _check_title(article: dict) -> list[Issue]:
    title = (article.get("title") or "").strip()
    if not title:
        return [Issue("error", "title", "missing")]
    if len(title) < 10:
        return [Issue("error", "title", f"{len(title)} chars — too short")]
    if len(title) > 100:
        return [Issue("warn", "title", f"{len(title)} chars — may truncate in search results (aim for ≤70)")]
    return []


def _check_meta_description(article: dict) -> list[Issue]:
    desc = (article.get("meta_description") or "").strip()
    if not desc:
        return [Issue("error", "meta_description", "missing — required for SEO and Google News")]
    # Google News tolerance: 120-170 is safe. Below 100 wastes the slot; above 170 gets truncated.
    if len(desc) < 100:
        return [Issue("warn", "meta_description",
                      f"{len(desc)} chars — below recommended 120 minimum")]
    if len(desc) > 170:
        return [Issue("error", "meta_description",
                      f"{len(desc)} chars — exceeds 170-char limit, will be truncated in SERPs")]
    return []


DATA_REPORTS_TITLE_KEYWORDS = [
    "report", "index", "survey", "study", "findings", "benchmark",
    "statistics", "census", "forecast", "outlook", "state of", "annual",
]


def _check_format(article: dict) -> list[Issue]:
    fmt = article.get("format", "")
    if not fmt:
        return [Issue("error", "format", "missing — required for category badges and filter pages")]
    if fmt not in VALID_FORMATS:
        return [Issue("error", "format",
                      f"{fmt!r} not in canonical set: {sorted(VALID_FORMATS)}")]
    issues: list[Issue] = []
    if fmt != "data-reports":
        title = (article.get("title") or "").lower()
        if any(kw in title for kw in DATA_REPORTS_TITLE_KEYWORDS):
            issues.append(Issue(
                "warn", "format",
                f"title contains data/report keywords — consider using 'data-reports' format instead of '{fmt}'"
            ))
    return issues


def _check_themes(article: dict) -> list[Issue]:
    themes = article.get("themes") or []
    if not isinstance(themes, list):
        return [Issue("error", "themes", "must be a list")]
    if not themes:
        return [Issue("error", "themes", "at least one theme required (used by /themes/[slug] hub)")]
    issues: list[Issue] = []
    invalid = [t for t in themes if t not in CANONICAL_THEMES]
    if invalid:
        issues.append(Issue(
            "error", "themes",
            f"invalid theme slug(s): {invalid}. Must be one of {sorted(CANONICAL_THEMES)}"
        ))
    if len(themes) > 3:
        issues.append(Issue(
            "warn", "themes",
            f"{len(themes)} themes assigned — assign 1-3 for cleaner taxonomy"
        ))
    return issues


def _check_canonical_url(article: dict) -> list[Issue]:
    url = article.get("canonical_url", "")
    if not url:
        return [Issue("error", "canonical_url",
                      f"missing — must be set to {CANONICAL_DOMAIN}/news/{{slug}}")]
    if not url.startswith(CANONICAL_DOMAIN):
        return [Issue("error", "canonical_url",
                      f"{url!r} must point to productimpactpod.com (not Lovable or staging)")]
    slug = article.get("slug", "")
    expected = f"{CANONICAL_DOMAIN}/news/{slug}"
    if slug and url != expected:
        return [Issue("error", "canonical_url",
                      f"{url!r} doesn't match expected {expected!r}")]
    return []


def _check_author_slugs(article: dict) -> list[Issue]:
    authors = article.get("author_slugs") or []
    if not isinstance(authors, list) or not authors:
        return [Issue("error", "author_slugs",
                      "at least one author slug required (links to /people/[slug])")]
    issues: list[Issue] = []
    for a in authors:
        if not isinstance(a, str) or not SLUG_PATTERN.match(a):
            issues.append(Issue(
                "error", "author_slugs",
                f"{a!r} is not a valid slug (lowercase hyphen-separated)"
            ))
    return issues


def _check_publish_date(article: dict) -> list[Issue]:
    d = article.get("publish_date", "")
    if not d:
        return [Issue("error", "publish_date", "missing — required by Google News")]
    if not re.match(r"^\d{4}-\d{2}-\d{2}", str(d)):
        return [Issue("error", "publish_date",
                      f"{d!r} must be ISO 8601 YYYY-MM-DD")]
    return []


def _check_content(article: dict) -> list[Issue]:
    issues: list[Issue] = []
    md = article.get("content_markdown") or ""
    html = article.get("content_html") or ""
    if not md and not html:
        return [Issue("error", "content",
                      "neither content_markdown nor content_html set — cannot render article")]
    if not html:
        issues.append(Issue("warn", "content_html",
                            "missing — Astro renders from this field; Markdown fallback requires compile step"))
    # First-H1 duplicate detection (our site strips leading H1; authors should
    # not include the title as an H1 in their body)
    if html and re.match(r"^\s*<h1", html, re.IGNORECASE):
        issues.append(Issue("warn", "content_html",
                            "starts with <h1> — strip_first_h1 will remove it, but consider starting with the body"))
    return issues


def _check_hero_image(article: dict) -> list[Issue]:
    url = article.get("hero_image_url")
    if not url:
        return [Issue("warn", "hero_image_url",
                      "missing — article will render with theme-colour fallback. Google Discover prefers real images.")]
    if not url.startswith(("https://", "http://")):
        return [Issue("error", "hero_image_url",
                      f"{url!r} must be absolute URL")]
    alt = article.get("hero_image_alt")
    if url and not alt:
        return [Issue("warn", "hero_image_alt",
                      "missing — required for accessibility and Google Image SEO")]
    return []


def _check_overview_bullets(article: dict) -> list[Issue]:
    bullets = article.get("overview_bullets")
    if bullets is None:
        # auto-generated by the Astro template if missing; not blocking
        return []
    if not isinstance(bullets, list):
        return [Issue("error", "overview_bullets", "must be a list of strings")]
    if len(bullets) < 3:
        return [Issue("warn", "overview_bullets",
                      f"{len(bullets)} bullets — aim for 3-5 for a balanced TL;DR box")]
    if len(bullets) > 5:
        return [Issue("warn", "overview_bullets",
                      f"{len(bullets)} bullets — trim to 5 for focus")]
    return []


def _check_topics(article: dict) -> list[Issue]:
    topics = article.get("topics") or []
    if not isinstance(topics, list):
        return [Issue("error", "topics", "must be a list of slug strings")]
    issues: list[Issue] = []
    for t in topics:
        if not isinstance(t, str) or not SLUG_PATTERN.match(t):
            issues.append(Issue(
                "error", "topics",
                f"{t!r} must be lowercase hyphen-separated slug"
            ))
    return issues


# ── Public API ──────────────────────────────────────────────────────────────

CHECKS = [
    _check_slug, _check_title, _check_meta_description, _check_format,
    _check_themes, _check_canonical_url, _check_author_slugs,
    _check_publish_date, _check_content, _check_hero_image,
    _check_overview_bullets, _check_topics,
]


def validate(article: dict) -> list[Issue]:
    """Run every check and return the combined list of issues.

    No issues of severity 'error' means the article can be published.
    Warnings are printed but don't block.
    """
    issues: list[Issue] = []
    for check in CHECKS:
        issues.extend(check(article))
    return issues


def has_errors(issues: list[Issue]) -> bool:
    return any(i.severity == "error" for i in issues)


# ── CLI ─────────────────────────────────────────────────────────────────────

def _main(argv: list[str]) -> int:
    source_label = "stdin"
    if "--file" in argv:
        idx = argv.index("--file")
        path = argv[idx + 1] if idx + 1 < len(argv) else None
        if not path:
            print("Usage: validate_article.py [--file PATH]", file=sys.stderr)
            return 2
        with open(path, "r", encoding="utf-8") as fh:
            raw = fh.read()
        source_label = path
    else:
        raw = sys.stdin.read()

    try:
        article = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"✗ {source_label}: invalid JSON — {e}", file=sys.stderr)
        return 2

    if not isinstance(article, dict):
        print(f"✗ {source_label}: expected object, got {type(article).__name__}", file=sys.stderr)
        return 2

    issues = validate(article)

    errors = [i for i in issues if i.severity == "error"]
    warnings = [i for i in issues if i.severity == "warn"]

    slug = article.get("slug", "<no slug>")
    if errors:
        print(f"✗ {slug}: {len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
    elif warnings:
        print(f"⚠ {slug}: {len(warnings)} warning(s), no errors", file=sys.stderr)
    else:
        print(f"✓ {slug}: all checks passed", file=sys.stderr)

    for issue in issues:
        print(issue, file=sys.stderr)

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))

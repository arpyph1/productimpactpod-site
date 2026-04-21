#!/usr/bin/env python3
"""
Auto-tag articles as 'data-reports' format based on title and content keywords.

Articles about research reports, surveys, data analysis, indices, benchmarks,
and statistical findings should use the 'data-reports' format.

Usage:
  export PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=eyJ...
  python3 scripts/tag_data_reports.py
"""

import os
import sys
import json
import re
from urllib.request import urlopen, Request

SUPABASE_URL = os.environ.get("PUBLIC_SUPABASE_URL", os.environ.get("SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# Keywords that indicate data/research/report content
# Strong indicators: if title contains these, very likely data-reports
TITLE_STRONG = [
    "report", "index", "survey", "study", "findings", "benchmark",
    "statistics", "census", "forecast", "outlook", "barometer",
    "scorecard", "tracker", "monitor", "state of", "annual",
]

# Title patterns with numbers/percentages suggest data-driven content
TITLE_PATTERNS = [
    r"\d+\s*%",                    # percentages in title
    r"\d+\s*percent",
    r"roi\b",
    r"\bgap\b.*\d",                # "gap" with numbers
    r"\bsurge\b",
    r"\bdecline\b",
    r"\bgrowth\b.*\d",
    r"\$\d",                       # dollar amounts
    r"\d+\s*(?:billion|million|trillion)",
    r"q[1-4]\s*20\d{2}",          # quarterly references (Q1 2026)
]

# Content keywords (need multiple matches to qualify)
CONTENT_KEYWORDS = [
    "according to", "research shows", "data shows", "survey found",
    "study found", "report found", "analysis reveals", "findings suggest",
    "percent of", "percentage", "year-over-year", "quarter-over-quarter",
    "growth rate", "adoption rate", "deployment rate", "failure rate",
    "roi", "return on investment", "cost per", "revenue impact",
    "benchmark", "measured", "quantif", "correlat", "statistic",
    "respondents", "sample size", "methodology", "dataset",
    "stanford", "mckinsey", "gartner", "forrester", "idc",
    "deloitte", "accenture", "bain", "bcg",
]


def strip_html(html: str) -> str:
    return re.sub(r"<[^>]*>", " ", html or "").strip().lower()


def should_tag_as_data_reports(title: str, content_html: str, meta_desc: str) -> tuple[bool, list[str]]:
    title_lower = title.lower()
    text = f"{title_lower} {strip_html(content_html)} {(meta_desc or '').lower()}"
    reasons = []

    # Check strong title indicators
    for kw in TITLE_STRONG:
        if kw in title_lower:
            reasons.append(f"title contains '{kw}'")

    # Check title patterns
    for pattern in TITLE_PATTERNS:
        if re.search(pattern, title_lower, re.IGNORECASE):
            reasons.append(f"title matches pattern '{pattern}'")

    # Check content keywords (need 3+ matches)
    content_matches = []
    for kw in CONTENT_KEYWORDS:
        if kw in text:
            content_matches.append(kw)

    if len(content_matches) >= 3:
        reasons.append(f"content has {len(content_matches)} data keywords: {', '.join(content_matches[:5])}")

    # Decision: need at least 1 strong title match, or 1 title pattern + 3 content keywords
    if len(reasons) >= 1 and (
        any("title contains" in r for r in reasons)
        or any("title matches" in r for r in reasons)
        or len(content_matches) >= 5
    ):
        return True, reasons

    return False, reasons


def main():
    print("Data & Reports Auto-Tagger")
    print(f"Supabase: {SUPABASE_URL}\n")

    # Fetch all published articles
    url = f"{SUPABASE_URL}/rest/v1/articles?published=eq.true&select=id,slug,title,format,meta_description,content_html&order=publish_date.desc"
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=60) as resp:
        articles = json.loads(resp.read().decode())

    print(f"Fetched {len(articles)} published articles\n")

    already_tagged = 0
    newly_tagged = 0
    skipped = 0

    for a in articles:
        if a["format"] == "data-reports":
            already_tagged += 1
            continue

        should_tag, reasons = should_tag_as_data_reports(
            a["title"],
            a.get("content_html", ""),
            a.get("meta_description", ""),
        )

        if should_tag:
            print(f"  TAGGING: {a['title'][:70]}")
            for r in reasons[:3]:
                print(f"    → {r}")

            patch_url = f"{SUPABASE_URL}/rest/v1/articles?id=eq.{a['id']}"
            body = json.dumps({"format": "data-reports"}).encode()
            patch_req = Request(patch_url, data=body, headers={**HEADERS, "Prefer": "return=minimal"}, method="PATCH")
            try:
                with urlopen(patch_req, timeout=30) as resp:
                    newly_tagged += 1
            except Exception as e:
                print(f"    ERROR: {e}")
        else:
            skipped += 1

    print(f"\nDone:")
    print(f"  Already tagged: {already_tagged}")
    print(f"  Newly tagged:   {newly_tagged}")
    print(f"  Skipped:        {skipped}")


if __name__ == "__main__":
    main()

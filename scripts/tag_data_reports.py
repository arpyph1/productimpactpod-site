#!/usr/bin/env python3
"""
Auto-tag articles as 'data-reports' format based on title keywords.

Only tags articles whose TITLE clearly indicates data/research/report content.
Content-only matching is intentionally excluded to avoid false positives.

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
from urllib.error import URLError

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

# Only match when the TITLE clearly indicates data/report content.
# These are phrases/words that signal the article IS a report or data analysis.
TITLE_INDICATORS = [
    "report",
    "index",
    "survey",
    "study",
    "findings",
    "benchmark",
    "census",
    "forecast",
    "outlook",
    "state of",
    "annual ",
    "research:",
    "data:",
    "scorecard",
]

# Title patterns: percentages or dollar amounts paired with analytical framing
TITLE_DATA_PATTERNS = [
    r"\d+\s*(?:%|percent).*(?:gap|decline|surge|drop|rise|growth|adoption|deployment|roi|failure|barrier)",
    r"(?:gap|decline|surge|drop|rise|growth|adoption|deployment|roi|failure|barrier).*\d+\s*(?:%|percent)",
    r"\$\d+.*(?:cost|spend|investment|market|revenue|budget)",
    r"q[1-4]\s*20\d{2}.*(?:data|report|trend|hiring|surge|decline)",
    r"(?:data|report|trend|hiring|surge|decline).*q[1-4]\s*20\d{2}",
]

# Explicit exclusions: topics that aren't data reports even if they contain numbers
TITLE_EXCLUSIONS = [
    "how to", "why ", "guide", "playbook", "tutorial",
    "opinion", "interview", "leaves", "future of",
    "what is", "introducing", "launch", "announces",
    "review:", "hands-on", "first look",
]


def should_tag_as_data_reports(title: str) -> tuple[bool, str]:
    title_lower = title.lower().strip()

    # Check exclusions first
    for exc in TITLE_EXCLUSIONS:
        if exc in title_lower:
            return False, f"excluded by '{exc}'"

    # Check strong title indicators
    for kw in TITLE_INDICATORS:
        if kw in title_lower:
            return True, f"title contains '{kw}'"

    # Check title data patterns
    for pattern in TITLE_DATA_PATTERNS:
        if re.search(pattern, title_lower):
            return True, f"title matches data pattern"

    return False, "no match"


def main():
    print("Data & Reports Auto-Tagger (strict title-only matching)")
    print(f"Supabase: {SUPABASE_URL}\n")

    url = f"{SUPABASE_URL}/rest/v1/articles?published=eq.true&select=id,slug,title,format&order=publish_date.desc"
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=60) as resp:
            articles = json.loads(resp.read().decode())
    except URLError as e:
        print(f"ERROR fetching articles: {e}")
        sys.exit(1)

    print(f"Fetched {len(articles)} published articles\n")

    already_tagged = 0
    newly_tagged = 0
    skipped = 0

    for a in articles:
        if a["format"] == "data-reports":
            already_tagged += 1
            continue

        should_tag, reason = should_tag_as_data_reports(a["title"])

        if should_tag:
            print(f"  TAGGING: {a['title'][:70]}")
            print(f"    reason: {reason}")

            patch_url = f"{SUPABASE_URL}/rest/v1/articles?id=eq.{a['id']}"
            body = json.dumps({"format": "data-reports"}).encode()
            patch_req = Request(patch_url, data=body, headers={**HEADERS, "Prefer": "return=minimal"}, method="PATCH")
            try:
                with urlopen(patch_req, timeout=30):
                    newly_tagged += 1
            except URLError as e:
                print(f"    ERROR: {e}")
        else:
            skipped += 1

    print(f"\nResults:")
    print(f"  Already tagged: {already_tagged}")
    print(f"  Newly tagged:   {newly_tagged}")
    print(f"  Skipped:        {skipped}")


if __name__ == "__main__":
    main()

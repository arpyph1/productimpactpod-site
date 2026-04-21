#!/usr/bin/env python3
"""
Migrate articles with format 'interview' to 'data-reports'.
Run once after deploying the format rename.

Usage:
  export PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=eyJ...
  python3 scripts/migrate_interview_to_data_reports.py
"""

import os
import sys
import json
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
    "Prefer": "return=representation",
}

url = f"{SUPABASE_URL}/rest/v1/articles?format=eq.interview&select=id,slug,title,format"
req = Request(url, headers=HEADERS)
with urlopen(req, timeout=30) as resp:
    articles = json.loads(resp.read().decode())

print(f"Found {len(articles)} articles with format 'interview'")

if not articles:
    print("Nothing to migrate.")
    sys.exit(0)

for a in articles:
    print(f"  Migrating: {a['title'][:60]}")

patch_url = f"{SUPABASE_URL}/rest/v1/articles?format=eq.interview"
body = json.dumps({"format": "data-reports"}).encode()
req = Request(patch_url, data=body, headers={**HEADERS, "Prefer": "return=minimal"}, method="PATCH")
with urlopen(req, timeout=30) as resp:
    print(f"Updated {len(articles)} articles to format 'data-reports' (HTTP {resp.status})")

print("Done.")

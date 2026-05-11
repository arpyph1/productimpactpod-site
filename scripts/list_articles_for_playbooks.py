"""
List all published articles with title, current format, and slug.
Pipe output into Claude to pick the 10 best Playbook candidates.

Usage:
    cd scripts && python list_articles_for_playbooks.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from load_env import load_env
from supabase_client import rest_get

load_env()

articles = rest_get(
    "articles",
    "select=slug,title,subtitle,format,published&published=eq.true&order=publish_date.desc"
)

print(f"{'slug':<55} {'format':<14} title")
print("-" * 130)
for a in articles:
    slug   = (a.get("slug") or "")[:54]
    fmt    = (a.get("format") or "")[:13]
    title  = a.get("title") or ""
    sub    = a.get("subtitle") or ""
    label  = title + (f" — {sub}" if sub else "")
    print(f"{slug:<55} {fmt:<14} {label}")

print(f"\nTotal: {len(articles)} articles")

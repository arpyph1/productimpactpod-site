#!/usr/bin/env python3
"""
Sync podcast RSS episodes to Supabase episode_shownotes table.
AI-generated show notes are optional — runs without PRODUCT_IMPACT_SHOWNOTES_API_KEY.
"""

import os
import sys
import json
import re
import html
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError
from xml.etree import ElementTree as ET

FEED_URL = os.environ.get(
    "PUBLIC_PODCAST_RSS_URL",
    "https://anchor.fm/s/f32cce5c/podcast/rss",
)
SUPABASE_URL = os.environ.get("PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SHOWNOTES_API_KEY = os.environ.get("PRODUCT_IMPACT_SHOWNOTES_API_KEY", "")

NS = {
    "itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "media": "http://search.yahoo.com/mrss/",
}


def fetch_feed(url: str) -> bytes:
    print(f"Fetching RSS from {url}...")
    req = Request(url, headers={"User-Agent": "ProductImpact-Sync/1.0"})
    with urlopen(req, timeout=30) as resp:
        data = resp.read()
    print(f"Fetched {len(data)} bytes")
    return data


def parse_duration(raw: str) -> str:
    if not raw:
        return ""
    parts = raw.strip().split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return raw
    if len(nums) == 3:
        total = nums[0] * 3600 + nums[1] * 60 + nums[2]
    elif len(nums) == 2:
        total = nums[0] * 60 + nums[1]
    else:
        total = nums[0]
    hrs = total // 3600
    mins = (total % 3600) // 60
    return f"{hrs}:{mins:02d}:{total % 60:02d}" if hrs else f"{mins}:{total % 60:02d}"


def slug_from_title(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
    return slug[:80]


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]*>", "", html.unescape(text or "")).strip()


def parse_episodes(xml_bytes: bytes) -> list[dict]:
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        print("ERROR: No <channel> in RSS feed")
        return []

    channel_image = ""
    itunes_img = channel.find("itunes:image", NS)
    if itunes_img is not None:
        channel_image = itunes_img.get("href", "")

    items = channel.findall("item")
    print(f"Parsed {len(items)} episodes from feed")

    episodes = []
    for item in items:
        title = (item.findtext("title") or "").strip()
        guid = (item.findtext("guid") or "").strip()
        if not guid:
            continue

        link = (item.findtext("link") or "").strip()
        pub_raw = (item.findtext("pubDate") or "").strip()

        # Parse date
        published_at = None
        if pub_raw:
            for fmt in [
                "%a, %d %b %Y %H:%M:%S %z",
                "%a, %d %b %Y %H:%M:%S %Z",
                "%Y-%m-%dT%H:%M:%S%z",
            ]:
                try:
                    published_at = datetime.strptime(pub_raw, fmt).isoformat()
                    break
                except ValueError:
                    continue

        # Audio URL
        enclosure = item.find("enclosure")
        audio_url = enclosure.get("url", "") if enclosure is not None else ""

        # Image
        ep_img = item.find("itunes:image", NS)
        image_url = (ep_img.get("href", "") if ep_img is not None else "") or channel_image

        # Duration
        duration = parse_duration(item.findtext("itunes:duration", "", NS))

        # Episode/season numbers
        ep_num = item.findtext("itunes:episode", "", NS)
        season_num = item.findtext("itunes:season", "", NS)

        # Description — prefer content:encoded
        content_encoded = item.findtext("content:encoded", "", NS)
        itunes_summary = item.findtext("itunes:summary", "", NS)
        desc_raw = content_encoded or itunes_summary or (item.findtext("description") or "")
        description_plain = strip_html(desc_raw)
        meta_description = description_plain[:250]

        # Themes (auto-tag from keywords)
        themes = auto_tag_themes(title, description_plain)

        episodes.append({
            "episode_guid": guid,
            "slug": slug_from_title(title),
            "title": title,
            "meta_description": meta_description,
            "content_html": desc_raw if content_encoded else f"<p>{html.escape(description_plain)}</p>",
            "episode_number": int(ep_num) if ep_num and ep_num.isdigit() else None,
            "season_number": int(season_num) if season_num and season_num.isdigit() else None,
            "duration": duration,
            "themes": themes,
            "published_at": published_at,
            "published": True,
        })

    return episodes


THEME_KEYWORDS = {
    "ai-product-strategy": ["product strategy", "roadmap", "product leader", "product manag", "strategic", "ship"],
    "adoption-organizational-change": ["adoption", "organizational", "transformation", "enterprise", "scaling", "workforce", "deploy"],
    "agents-agentic-systems": ["agent", "agentic", "autonomous", "orchestrat", "copilot", "multi-agent"],
    "data-semantics-knowledge-foundations": ["data", "knowledge", "semantic", "graph", "rag", "retrieval", "embedding"],
    "evaluation-benchmarking": ["evaluat", "benchmark", "metric", "measur", "roi", "kpi", "accuracy"],
    "go-to-market-distribution": ["go-to-market", "pricing", "monetiz", "growth", "distribution", "launch", "market"],
    "governance-risk-trust": ["governance", "risk", "trust", "safety", "ethic", "bias", "regulat", "compliance"],
    "ux-experience-design-for-ai": ["ux", "user experience", "design", "interface", "human-centered", "conversational"],
}


def auto_tag_themes(title: str, desc: str) -> list[str]:
    text = f"{title} {desc}".lower()
    tags = []
    for slug, keywords in THEME_KEYWORDS.items():
        if any(k in text for k in keywords):
            tags.append(slug)
    if not tags:
        tags.append("ai-product-strategy")
    return tags


def upsert_to_supabase(episodes: list[dict]):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    url = f"{SUPABASE_URL}/rest/v1/episode_shownotes"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Upsert in batches of 20
    batch_size = 20
    total = 0
    for i in range(0, len(episodes), batch_size):
        batch = episodes[i : i + batch_size]
        body = json.dumps(batch).encode("utf-8")
        req = Request(url, data=body, headers=headers, method="POST")
        try:
            with urlopen(req, timeout=30) as resp:
                status = resp.status
                total += len(batch)
                print(f"  Upserted batch {i // batch_size + 1}: {len(batch)} episodes (HTTP {status})")
        except URLError as e:
            print(f"  ERROR upserting batch {i // batch_size + 1}: {e}")
            if hasattr(e, "read"):
                print(f"  Response: {e.read().decode()}")

    print(f"Done. {total}/{len(episodes)} episodes synced to Supabase.")


def main():
    xml = fetch_feed(FEED_URL)
    episodes = parse_episodes(xml)
    if not episodes:
        print("No episodes found. Exiting.")
        sys.exit(1)

    if SHOWNOTES_API_KEY:
        print(f"PRODUCT_IMPACT_SHOWNOTES_API_KEY is set — AI show notes generation available.")
    else:
        print("PRODUCT_IMPACT_SHOWNOTES_API_KEY not set — syncing RSS metadata only (this is fine).")

    upsert_to_supabase(episodes)


if __name__ == "__main__":
    main()

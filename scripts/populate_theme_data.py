#!/usr/bin/env python3
"""
Auto-tag entities and episodes with themes based on keyword matching.

Reads entities and episodes from Supabase, analyzes their text content
against theme keywords, and updates their `themes` arrays.

Usage:
  export PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  export SUPABASE_SERVICE_ROLE_KEY=eyJ...
  python3 scripts/populate_theme_data.py

Also links entities to themes via their associated articles.
"""

import os
import sys
import json
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

THEME_KEYWORDS: dict[str, list[str]] = {
    "ai-product-strategy": [
        "product strategy", "roadmap", "prioriti", "product-market", "product leader",
        "product manag", "product vision", "strategic", "ship", "ai strategy",
        "product thinking", "build vs buy", "ai product",
    ],
    "adoption-organizational-change": [
        "adoption", "organizational", "change management", "transformation", "enterprise",
        "scaling", "resistance", "stakeholder", "workforce", "deploy", "rollout",
        "pilot", "champion", "implementation",
    ],
    "agents-agentic-systems": [
        "agent", "agentic", "autonomous", "multi-agent", "orchestrat", "copilot",
        "chatbot", "tool use", "function call", "reasoning", "chain of thought",
    ],
    "data-semantics-knowledge-foundations": [
        "data", "knowledge", "semantic", "ontolog", "taxonomy", "graph", "rag",
        "retrieval", "embedding", "vector", "fine-tun", "training data", "annotation",
    ],
    "evaluation-benchmarking": [
        "evaluat", "benchmark", "metric", "measur", "kpi", "roi", "testing",
        "a/b test", "accuracy", "performance", "quality",
    ],
    "go-to-market-distribution": [
        "go-to-market", "gtm", "distribution", "pricing", "monetiz", "freemium",
        "growth", "acquisition", "retention", "competitive", "launch", "market fit",
    ],
    "governance-risk-trust": [
        "governance", "risk", "trust", "safety", "ethic", "bias", "fairness",
        "regulat", "compliance", "transparen", "responsible", "guardrail", "alignment",
    ],
    "ux-experience-design-for-ai": [
        "ux", "user experience", "design", "interface", "interaction", "usability",
        "human-centered", "conversational", "prototype", "wireframe", "accessibility",
    ],
}


def supabase_get(table: str, params: str = "") -> list[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def supabase_patch(table: str, match_col: str, match_val: str, body: dict):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{match_col}=eq.{match_val}"
    data = json.dumps(body).encode()
    req = Request(url, data=data, headers={**HEADERS, "Prefer": "return=minimal"}, method="PATCH")
    with urlopen(req, timeout=30) as resp:
        return resp.status


def auto_tag(title: str, description: str, existing_themes: list[str] | None = None) -> list[str]:
    text = f"{title} {description}".lower()
    tags = set(existing_themes or [])
    for slug, keywords in THEME_KEYWORDS.items():
        if any(k in text for k in keywords):
            tags.add(slug)
    return sorted(tags)


def populate_entity_themes():
    print("\n=== Populating entity themes ===")
    entities = supabase_get("entities", "select=id,slug,name,description,themes,type")
    print(f"Fetched {len(entities)} entities")

    articles = supabase_get("articles", "select=id,slug,themes&published=eq.true")
    print(f"Fetched {len(articles)} published articles")

    try:
        article_entities = supabase_get("article_entities", "select=entity_id,article_id")
        print(f"Fetched {len(article_entities)} article-entity links")
    except Exception as e:
        print(f"  WARNING: Could not fetch article_entities: {e}")
        article_entities = []

    article_themes_by_id: dict[str, list[str]] = {}
    for a in articles:
        article_themes_by_id[a.get("id", "")] = a.get("themes") or []

    entity_article_themes: dict[str, set[str]] = {}
    for ae in article_entities:
        eid = ae.get("entity_id", "")
        aid = ae.get("article_id", "")
        if eid and aid:
            if eid not in entity_article_themes:
                entity_article_themes[eid] = set()
            for t in article_themes_by_id.get(aid, []):
                entity_article_themes[eid].add(t)

    updated = 0
    for entity in entities:
        old_themes = set(entity.get("themes") or [])

        new_themes_from_text = auto_tag(
            entity.get("name", ""),
            entity.get("description") or "",
        )

        new_themes_from_articles = entity_article_themes.get(entity["id"], set())

        combined = sorted(old_themes | set(new_themes_from_text) | new_themes_from_articles)

        if set(combined) != old_themes:
            try:
                supabase_patch("entities", "id", entity["id"], {"themes": combined})
                added = set(combined) - old_themes
                print(f"  {entity['name']}: +{', '.join(added)}")
                updated += 1
            except URLError as e:
                print(f"  ERROR updating {entity['name']}: {e}")

    print(f"Updated {updated}/{len(entities)} entities")


def populate_episode_themes():
    print("\n=== Populating episode themes ===")
    episodes = supabase_get(
        "episode_shownotes",
        "select=id,episode_guid,title,meta_description,themes,published&published=eq.true"
    )
    print(f"Fetched {len(episodes)} published episodes")

    updated = 0
    for ep in episodes:
        old_themes = set(ep.get("themes") or [])
        new_themes = auto_tag(
            ep.get("title", ""),
            ep.get("meta_description") or "",
            list(old_themes),
        )

        if set(new_themes) != old_themes:
            try:
                supabase_patch("episode_shownotes", "id", ep["id"], {"themes": new_themes})
                added = set(new_themes) - old_themes
                print(f"  EP {ep.get('title', '')[:60]}: +{', '.join(added)}")
                updated += 1
            except URLError as e:
                print(f"  ERROR updating episode: {e}")

    print(f"Updated {updated}/{len(episodes)} episodes")


def main():
    print("Theme Data Population Script")
    print(f"Supabase: {SUPABASE_URL}")

    populate_entity_themes()
    populate_episode_themes()

    print("\nDone. Theme pages will be populated on next site rebuild.")


if __name__ == "__main__":
    main()

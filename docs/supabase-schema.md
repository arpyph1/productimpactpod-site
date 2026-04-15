# Supabase Schema Requirements

This document captures the tables, columns, and seed data the Astro site
expects from the shared Supabase project (`cyqkfkvsrdbbjuaqiglx.supabase.co`).

**Before first publish**, verify each table exists with the shape below and
that RLS policies permit anonymous SELECT. The site's build will error or
render empty state if these are missing.

The canonical schema is defined by the Lovable-era migration at
`arpyph1/product-impact-podcast-web/supabase/migrations/20260409212800_…sql`.
Everything below matches that migration — this doc is a reference, not a
second source of truth.

---

## Required tables

### `articles` (primary content table)

```
id                     uuid PRIMARY KEY
slug                   text UNIQUE NOT NULL
title                  text NOT NULL
subtitle               text
format                 text NOT NULL DEFAULT 'news-brief'
author_slugs           text[] NOT NULL DEFAULT '{}'
byline_role            text
dateline               text
publish_date           date NOT NULL
last_updated           timestamptz DEFAULT now()
read_time_minutes      int
word_count             int
meta_description       text NOT NULL DEFAULT ''
hero_image_url         text
hero_image_alt         text
hero_image_credit      text
content_markdown       text NOT NULL DEFAULT ''
content_html           text NOT NULL DEFAULT ''
themes                 text[] NOT NULL DEFAULT '{}'
lenses                 text[] NOT NULL DEFAULT '{}'
topics                 text[] DEFAULT '{}'
primary_podcast_episode_guid  text
schema_jsonld          jsonb
canonical_url          text NOT NULL DEFAULT ''
published              boolean DEFAULT false
-- plus cms_locked_* booleans for admin surface
created_at / updated_at timestamptz
```

Used by: every page that lists or renders articles.

**Values validated by `publish_articles.py`:**
- `format` must be one of: `news-brief`, `news-analysis`, `release-note`,
  `feature`, `interview`, `case-study`, `opinion`, `explainer`,
  `product-review`, `research-brief`
- `themes[]` must all be in the canonical 8-slug list (see
  `src/lib/themes.ts`)
- `canonical_url` must start with `https://productimpactpod.com`
- `meta_description` length 120–160 chars

### `shownotes` (podcast episodes)

```
episode_guid           text PRIMARY KEY
slug                   text
title                  text NOT NULL
content_html           text
meta_description       text
episode_number         int
season_number          int
duration               text                  -- e.g. "45:30"
themes                 text[]
lenses                 text[]
hosts                  text[]
guests                 jsonb                 -- array of { name, role?, linkedin?, website? }
transcript_markdown    text
schema_jsonld          jsonb
published_at           timestamptz
links                  jsonb                 -- array of { label, url }
video_urls             text[]
published              boolean DEFAULT false
```

Used by: `/podcast`, `/episodes`, `/episodes/[slug]`, homepage episode strip.

### `entities` (people, concepts, organizations, products, frameworks, sources)

```
id                     uuid PRIMARY KEY
type                   entity_type NOT NULL   -- enum
slug                   text NOT NULL
name                   text NOT NULL
aliases                text[] DEFAULT '{}'
description            text
long_form              text
external_links         jsonb DEFAULT '[]'     -- [{ label, url }, …]
metadata               jsonb DEFAULT '{}'
themes                 text[] DEFAULT '{}'
lenses                 text[] DEFAULT '{}'
canonical_url          text NOT NULL DEFAULT ''
schema_jsonld          jsonb
UNIQUE(type, slug)
```

`entity_type` enum values: `concept`, `person`, `organization`, `product`,
`framework`, `source`.

Used by: all 6 entity index pages, all 6 entity detail pages, article sidebars.

**Minimum seed for first publish** — create rows for the hosts so
`/people/arpy-dragffy` and `/people/brittany-hobbs` don't redirect:

```sql
INSERT INTO public.entities (type, slug, name, description, external_links, canonical_url) VALUES
  ('person', 'arpy-dragffy', 'Arpy Dragffy',
   'Founder of PH1 Research and AI Value Acceleration. Co-host of Product Impact Podcast.',
   '[{"label":"PH1 Research","url":"https://ph1.ca"},{"label":"AI Value Acceleration","url":"https://aivalueacceleration.com"},{"label":"LinkedIn","url":"https://linkedin.com/in/arpydragffy"}]'::jsonb,
   'https://productimpactpod.com/people/arpy-dragffy'),
  ('person', 'brittany-hobbs', 'Brittany Hobbs',
   'Product leader working at the intersection of AI capabilities, product strategy, and go-to-market. Co-host of Product Impact Podcast.',
   '[{"label":"LinkedIn","url":"https://linkedin.com/in/brittanyhobbs"}]'::jsonb,
   'https://productimpactpod.com/people/brittany-hobbs');
```

### `article_entities` (many-to-many join)

```
article_id    uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE
entity_id     uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE
relevance     text DEFAULT 'mention'    -- 'mention' | 'subject' | 'author'
PRIMARY KEY (article_id, entity_id)
```

Used by: article page sidebar, entity detail pages.

The Astro query uses a nested Supabase select that joins through this
table via UUIDs, not slugs. Ensure the table exists before first publish or
the article sidebar will silently render empty.

### `themes` (the canonical 8)

```
id                      uuid PRIMARY KEY
slug                    text UNIQUE NOT NULL
name                    text NOT NULL
description             text NOT NULL DEFAULT ''
long_form_intro         text
meta_description        text
target_search_queries   text[]
schema_jsonld           jsonb
hero_image_url          text
theme_color             text
icon                    text
updated_at              timestamptz
```

Used by: `/themes`, `/themes/[slug]`. Site falls back to the hard-coded
`src/lib/themes.ts` content if the table is empty, so this is not strictly
blocking — but populating it unlocks per-theme `long_form_intro` overrides.

**Required seed** — the 8 canonical slugs must match exactly:
`ai-product-strategy`, `agents-agentic-systems`,
`ux-experience-design-for-ai`, `adoption-organizational-change`,
`evaluation-benchmarking`, `go-to-market-distribution`,
`data-semantics-knowledge-foundations`, `governance-risk-trust`.

### `lenses` (optional taxonomy table)

```
id    uuid PRIMARY KEY
slug  text
name  text
```

Not currently queried by the site — lenses render from the `articles.lenses[]`
array directly. Table can exist or not; no blocker.

---

## RLS policies

All tables the site reads must permit `SELECT` for the `anon` role:

```sql
-- articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can read published articles"
  ON public.articles FOR SELECT
  TO anon USING (published = true);

-- entities (no publish flag — all rows are readable)
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can read entities"
  ON public.entities FOR SELECT
  TO anon USING (true);

-- article_entities
ALTER TABLE public.article_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can read article_entities"
  ON public.article_entities FOR SELECT
  TO anon USING (true);

-- themes
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can read themes"
  ON public.themes FOR SELECT
  TO anon USING (true);

-- shownotes
ALTER TABLE public.shownotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can read published shownotes"
  ON public.shownotes FOR SELECT
  TO anon USING (published = true);
```

Verify by running a `curl` probe with the anon key:

```bash
curl -s -H "apikey: $PUBLIC_SUPABASE_ANON_KEY" \
  "$PUBLIC_SUPABASE_URL/rest/v1/articles?select=slug,title&published=eq.true&limit=1"
```

If the result is `[]` when published articles exist, RLS is blocking the
read. If it's a JSON error, the column names don't match.

---

## Edge functions

### `get-latest-short` (required for `/podcast` YouTube Shorts)

Already deployed from Lovable era. Takes `{ channelId, count }`, calls
YouTube Data API v3 using the `YOUTUBE_API_KEY` env var set in Supabase
project settings. Returns `{ shorts: [...], mostWatched: {...} }`.

Invoked from `src/lib/supabase.ts → getLatestShorts()` at build time.

**If you rotate or re-deploy this function**, ensure the `YOUTUBE_API_KEY`
env var is still set in Supabase → Project Settings → Edge Functions →
Secrets.

---

## Pre-publish checklist

Before running `publish_articles.py` against the new site:

- [ ] `articles` table exists and has the shape above
- [ ] `entities` table exists
- [ ] `article_entities` join table exists
- [ ] `themes` table seeded with the 8 canonical slugs (or accept the
      hard-coded fallback from `src/lib/themes.ts`)
- [ ] `shownotes` table exists (or accept empty `/episodes` listing)
- [ ] Entity rows for `arpy-dragffy` and `brittany-hobbs` seeded
- [ ] RLS policies permit anon SELECT on all 5 read tables
- [ ] `YOUTUBE_API_KEY` secret set in Supabase edge-function env
- [ ] Anon key in `.env.example` is still valid (JWT not expired)
- [ ] Curl probe returns a published article

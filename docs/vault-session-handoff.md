# Product Impact — Vault-system session handoff

> **Who this is for:** a new Claude Code session running inside
> `arpyph1/vault-system` (private repo). The session needs to stand up the
> publishing pipeline that reads markdown drafts from vault and pushes
> them to the live site at [productimpactpod.com](https://productimpactpod.com).
>
> **Why this doc exists:** the site-building session that created everything
> below doesn't persist. This file captures every architectural decision,
> every convention, and every URL the new session needs — so the vault
> session can do real work immediately without round-tripping.

---

## 1. Executive summary

Product Impact is a news publication about AI products. The content-publishing
system consists of three independently-deployed pieces:

| Piece | Repo / service | Purpose |
|---|---|---|
| **vault-system** | `arpyph1/vault-system` (private) | Holds episode transcripts, editorial briefs, article drafts, and the `publish_articles.py` orchestrator |
| **productimpactpod-site** | `arpyph1/productimpactpod-site` (public) | Astro static-site generator + publishing scripts library |
| **Supabase** | project `pgsljoqwfhufubodlqjk` | Database + Storage + Edge Functions — the data bus between vault and site |
| **Cloudflare Pages** | project `productimpactpod-site` | Static-site hosting, custom domain `productimpactpod.com` |

You (this new session) are working inside **vault-system**. The site repo
is added as a git submodule at `product-impact/scripts/site/` so you can
import its Python publishing scripts directly.

---

## 2. Data flow — how a draft becomes a live article

```
  Human author:
  1. writes draft in  vault-system/product-impact/drafts/X.md
  2. runs             python3 product-impact/scripts/publish_articles.py \
                        product-impact/drafts/X.md

  publish_articles.py (running inside vault-system):
  ┌─────────────────────────────────────────────────────────────────┐
  │ a. Parse markdown frontmatter → article dict                     │
  │ b. Import validate_article.py from the site submodule, validate  │
  │ c. Import generate_hero_image.py, if no hero_image_url:           │
  │    - Claude Opus 4.6 distills one-sentence photographic prompt    │
  │    - Replicate Flux 1.1 Pro renders 1200×628 PNG                  │
  │    - Upload to Supabase Storage bucket `article-heroes`           │
  │ d. INSERT/UPSERT into Supabase `articles` table (service_role)   │
  │ e. Link entities into `article_entities` via entity slugs        │
  │ f. Move draft file → product-impact/published/YYYY/MM/X.md       │
  │ g. Import dispatch_rebuild.py, POST to GitHub dispatch API       │
  └─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
  GitHub Actions workflow `publish-trigger.yml` receives
    repository_dispatch event of type `content-published`
                            │
                            ▼  curls CF_DEPLOY_HOOK_URL
                            │
  Cloudflare Pages rebuilds the Astro site:
    • Astro queries Supabase at build time (anon key, public reads)
    • Generates one static HTML file per published article, entity,
      theme, topic, date archive, format filter, episode
    • JSON-LD NewsArticle schema, OG tags, sitemap entries all
      server-rendered
                            │
                            ▼  deploys to 300+ edge locations
                            │
                            ▼
  Article live at https://productimpactpod.com/news/X  (~60–90s after publish)
```

**Key architectural principle:** vault and site never talk to each other
directly. They communicate through Supabase (data) and GitHub Actions
(rebuild trigger). Either can be swapped without affecting the other.

---

## 3. What lives where

### `vault-system/product-impact/` (this repo)

```
product-impact/
├── pre-production/           ← private source material (never public)
│   ├── sources/              ← press releases, scraped research, background
│   │   ├── YYYY-MM/          ← time-bucketed for fleeting references
│   │   └── by-topic/         ← durable topic research folders
│   ├── episodes/             ← raw podcast artefacts
│   │   └── ep-XXX/
│   │       ├── raw-transcript.md
│   │       ├── guest-prep.md
│   │       └── clips.md
│   └── briefs/               ← one-para editorial plans before drafting
│
├── drafts/                   ← articles in progress (YAML + markdown)
│   ├── _TEMPLATE.md          ← copy-from template
│   └── <slug>.md
│
├── published/                ← post-publish archive (audit trail)
│   └── YYYY/MM/<slug>.md     ← draft files move here after successful publish
│
└── scripts/
    ├── publish_articles.py   ← main orchestrator (you build this)
    ├── site/                 ← ← git submodule: productimpactpod-site
    │   └── scripts/publishing/
    │       ├── validate_article.py        (ready to import)
    │       ├── generate_hero_image.py     (ready to import)
    │       ├── dispatch_rebuild.py        (ready to import)
    │       ├── verify_supabase.py         (run once for env check)
    │       └── README.md                  (integration patterns)
    └── utils/                ← vault-specific helpers (markdown parsing, etc.)
```

### `productimpactpod-site` (the public site repo, accessible as submodule)

What you'll reference from vault:
- `scripts/publishing/*.py` — the three publishing tools + verifier
- `src/lib/themes.ts` — canonical theme definitions (read-only reference)
- `src/lib/supabase.ts` — TypeScript interfaces for each table (shape reference)
- `supabase/migrations/*.sql` — applied schema (reference only, already applied)
- `supabase/functions/get-latest-short/` — deployed edge function (already live)
- `vault-integration/` — starter templates you can copy into this vault
- `docs/supabase-schema.md` — table-by-table reference

### Supabase (project `pgsljoqwfhufubodlqjk`)

```
project URL: https://pgsljoqwfhufubodlqjk.supabase.co
dashboard:   https://supabase.com/dashboard/project/pgsljoqwfhufubodlqjk
owner:       info@productimpactpod.com (fresh project, not Lovable's)

Tables already created + seeded:
  articles             — main content; 0 rows; RLS anon-read on published=true
  entities             — 2 rows (arpy-dragffy, brittany-hobbs)
  article_entities     — join table; UUID foreign keys (article_id, entity_id)
  episode_entities     — for podcast episode tagging; empty
  episode_shownotes    — podcast episodes (NOT "shownotes" — Lovable legacy name)
  article_faqs, episode_faqs — optional FAQ schemas; empty
  themes               — 8 canonical themes seeded
  lenses               — 4 canonical lenses seeded
  sponsors             — 0 rows
  profiles, user_roles — auth infrastructure (future admin UI)

Storage:
  article-heroes       — public bucket, 10MB limit, accepts PNG/JPEG/WebP

Edge Functions:
  get-latest-short     — deployed. Reads YOUTUBE_API_KEY secret.
                         Called from /podcast page at build time.
```

### Cloudflare Pages

```
Project:       productimpactpod-site
Production URL: https://productimpactpod-site.pages.dev
Custom domain: productimpactpod.com
Build command: npm install && npm run build
Build output:  dist
Env vars set:  PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY

Deploy hooks:
  GitHub Actions trigger → fired by publish-trigger.yml workflow
                           → triggered by repository_dispatch from vault
                           → triggered by scheduled-rebuild.yml every 6h
```

---

*Next: Section 2 covers canonical taxonomies (themes, formats, entity
types, lenses) and the article frontmatter contract that validate_article.py
enforces.*

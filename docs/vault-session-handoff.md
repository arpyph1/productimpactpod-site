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

## 4. Canonical taxonomies

These enumerations are **enforced by `validate_article.py`** — publishes
that reference values outside these sets are rejected. Do not invent
new values. If a new theme or format is genuinely needed, it's a schema
change that requires updating the site repo's canonicals first, then
this doc.

### 4.1 Themes (the 8 canonicals)

Every article has 1–3 themes. The first theme drives the colour fallback
for hero-image placeholders and the `articleSection` field in NewsArticle
JSON-LD. Themes map 1:1 to `/themes/{slug}` hub pages on the site.

| Slug | Display name | Coverage |
|---|---|---|
| `ai-product-strategy` | AI Product Strategy | How product leaders integrate AI into strategy, roadmaps, and competitive positioning |
| `agents-agentic-systems` | Agents & Agentic Systems | Autonomous AI agents, multi-agent architectures, agentic workflows |
| `ux-experience-design-for-ai` | UX & Experience Design for AI | Designing human-AI interactions, AI UX patterns, experience design |
| `adoption-organizational-change` | Adoption & Organizational Change | How organizations adopt AI tools, manage change, measure impact |
| `evaluation-benchmarking` | Evaluation & Benchmarking | How to measure AI performance, evaluate models, benchmark products |
| `go-to-market-distribution` | Go-to-Market & Distribution | AI product distribution, pricing, GTM strategy, market dynamics |
| `data-semantics-knowledge-foundations` | Data, Semantics & Knowledge Foundations | Data quality, knowledge graphs, semantic layers, foundations AI needs |
| `governance-risk-trust` | Governance, Risk & Trust | AI governance, safety, trust, regulation, responsible deployment |

Source of truth (site): [`src/lib/themes.ts`](https://github.com/arpyph1/productimpactpod-site/blob/main/src/lib/themes.ts).

### 4.2 Formats (the 10 canonicals)

Every article has exactly one format. It drives the badge shown on card
layouts and filters the `/news/format/{slug}` route.

| Slug | Meaning |
|---|---|
| `news-brief` | Short dispatches on developments, releases, market moves (~300-500 words) |
| `news-analysis` | In-depth analysis of trends, decisions, industry implications (~800-1500 words) |
| `release-note` | Coverage of new product releases, feature launches, platform updates |
| `feature` | Long-form feature stories (~1500+ words) |
| `interview` | Conversations with product leaders, researchers, practitioners |
| `case-study` | Real-world case studies of AI adoption, outcomes, lessons |
| `opinion` | Perspective and commentary; clearly labelled as opinion |
| `explainer` | Definitional pieces for concepts, frameworks — the "What is X" answer format |
| `product-review` | Hands-on reviews of AI products, tools, platforms |
| `research-brief` | Summaries of research relevant to practitioners |

The `explainer` format is special: topic hub pages (`/topics/{slug}`)
feature the most-recent explainer tagged with that topic as the
"definer article." Use this format when writing something intended to
be an answer-engine / LLM-citation target.

### 4.3 Entity types (the 6 canonicals)

Entity rows in the `entities` table have a `type` column constrained to:

| Type | Examples | URL path |
|---|---|---|
| `person` | Arpy Dragffy, Brittany Hobbs, guest interviewees | `/people/{slug}` |
| `concept` | RAG, Tool Use, Context Window, Evaluation | `/concepts/{slug}` |
| `organization` | Anthropic, OpenAI, Microsoft | `/organizations/{slug}` |
| `product` | Claude, ChatGPT, Copilot, Cursor | `/products/{slug}` |
| `framework` | NIST AI RMF, EU AI Act, responsible AI frameworks | `/frameworks/{slug}` |
| `source` | Research papers, press releases, primary sources | `/sources/{slug}` |

Entities are linked to articles via the `article_entities` join table
(UUID foreign keys: `article_id`, `entity_id`, plus a `relevance` field
defaulting to `'mention'`). The site renders linked entities as a sidebar
on article pages.

**Seeded entities:** only the two hosts. Every other entity needs to be
inserted into the `entities` table before it can be linked from an article.
Your `publish_articles.py` should handle entity auto-creation or warn on
unknown slugs.

### 4.4 Lenses (the 4 canonicals)

Optional editorial perspective tags. Not required on articles. Rendered
as secondary badges alongside themes.

| Slug | Audience |
|---|---|
| `business-lens` | C-suite, VPs, founders — strategic/commercial framing |
| `product-lens` | PMs, founders, product designers — product craft framing |
| `societal-lens` | Policymakers, researchers, the public — broader implications |
| `technical-lens` | Engineers, ML researchers — technical depth |

---

## 5. Article frontmatter contract

Every draft markdown file has YAML frontmatter + markdown body. The
frontmatter maps 1:1 to columns in the Supabase `articles` table. Your
`parse_vault_markdown()` function must return a dict with these keys.

### 5.1 Required fields (validator will reject publishes missing these)

```yaml
---
# URL slug — must match the filename without .md
# Lowercase, hyphen-separated alphanumerics only, ≤100 chars (≤60 recommended)
slug: claude-46-managed-agents-platform-shift

# 10–100 chars. ≤70 recommended to avoid SERP truncation.
title: Claude 4.6 Signals a Managed-Agents Platform Shift

# Must be exactly one of the 10 canonical formats
format: news-analysis

# At least one host or person slug. Must be valid slugs.
# These link to /people/{slug} pages.
author_slugs:
  - arpy-dragffy

# ISO 8601 date (YYYY-MM-DD). Must not be in the future at publish time.
publish_date: 2026-04-16

# 120–170 chars. SERP descriptor. Writes for click-through.
# Under 120 wastes the slot; over 170 gets truncated.
meta_description: |
  Anthropic's Claude 4.6 bundles Managed Agents alongside the model — the
  platform layer is where product teams should now focus, not the weights.

# Subset of the canonical 8 themes. 1–3 recommended.
themes:
  - ai-product-strategy
  - agents-agentic-systems

# MUST start with https://productimpactpod.com/news/ and end with the slug.
# The validator enforces exact equality: f"https://productimpactpod.com/news/{slug}"
canonical_url: https://productimpactpod.com/news/claude-46-managed-agents-platform-shift
---
```

### 5.2 Optional fields (auto-filled or safely omitted)

```yaml
# Subtitle / deck. One sentence elaborating the headline.
subtitle: Anthropic's latest release reframes where product differentiation
  happens — above the model, in the orchestration layer.

# Hero image. If null, generate_hero_image.py creates one from the article
# context using Claude-distilled prompt + Flux 1.1 Pro, uploads to
# Supabase Storage bucket article-heroes, returns the public URL.
hero_image_url: null
hero_image_alt: null                # auto-generated from title if null
hero_image_credit: null             # e.g. "Generated via Flux 1.1 Pro"

# TL;DR bullets shown in the Overview box above the article body.
# If null, the Astro template extracts them from H2 sections at render time.
# Aim for 3-5 items when providing explicitly.
overview_bullets:
  - First key insight in one sentence.
  - Second key insight.
  - Third key insight.

# Free-form per-article topic tags. Each becomes a /topics/{slug} hub.
# Lowercase hyphen-separated slugs. 3–10 recommended. No canonical list —
# use whatever makes sense, site aggregates them automatically.
topics:
  - claude
  - anthropic
  - managed-agents
  - enterprise-ai

# Optional lens(es) from the canonical 4.
lenses:
  - business-lens
  - product-lens

# Byline metadata.
byline_role: Co-host & Producer      # Displayed under author name
dateline: San Francisco               # Traditional news dateline convention

# Auto-computed by publisher from word count if null.
read_time_minutes: null
word_count: null

# Link to related podcast episode, if article originated from an episode.
primary_podcast_episode_guid: null

# Override the auto-generated NewsArticle JSON-LD. Leave null unless you
# have a specific schema need (e.g. Event schema for a conference recap).
schema_jsonld: null

# CMS-locking flags (for future admin UI). Leave all false.
cms_locked_themes: false
cms_locked_meta: false
cms_locked_schema: false
cms_locked_hero: false

# Published flag. publish_articles.py sets this to true AFTER all
# validation and upload steps succeed. Keep false in the draft.
published: false
```

### 5.3 Body content

Below the frontmatter, markdown body. The publisher renders to HTML
using your parser (e.g. `markdown` Python library with `extra` and `toc`
extensions). Both fields are stored:

- `content_markdown` — the raw markdown body (for future re-rendering
  or alternate outputs)
- `content_html` — the rendered HTML (what the Astro template injects
  into the article page)

### 5.4 Critical style rules enforced by the site

- **Do not include an H1 in the body.** The Astro template renders its
  own H1 from `title`. A leading H1 in `content_html` gets stripped by
  `stripFirstH1()` in the site — but the validator warns on it.
- **Start with a lead paragraph, not a heading.** The first H2 is the
  first section divider.
- **Use semantic HTML:** `<h2>` for sections, `<h3>` sparingly for
  subsections, `<blockquote>` for pull-quotes, `<ul>`/`<ol>` for lists,
  `<code>` for inline code, `<pre><code>` for blocks. Our article-prose
  CSS styles all of these.
- **Link primary sources inline** — every factual claim should have a
  markdown link to the originating source. This is what makes articles
  citable by LLMs and aggregators.

---

*Next: Section 6 covers the three publishing scripts (validate_article.py,
generate_hero_image.py, dispatch_rebuild.py) — what each does, how to
invoke, and what they return. Section 7 covers the verify_supabase.py
environment-check tool.*

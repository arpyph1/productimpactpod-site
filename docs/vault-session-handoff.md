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

## 6. Publishing scripts reference

All four scripts live in the site repo at `scripts/publishing/`. Once
the site repo is added as a submodule at `product-impact/scripts/site/`
in vault-system, they are importable from:

```python
sys.path.insert(
    0,
    str(Path(__file__).resolve().parent / "site" / "scripts" / "publishing"),
)
from validate_article import validate, has_errors, Issue
from generate_hero_image import generate as generate_hero, GenerateResult
from dispatch_rebuild import dispatch
```

Each script is also runnable as a CLI (reads JSON on stdin, writes to
stdout/stderr, exits 0 on success).

Live source on GitHub:
- [validate_article.py](https://github.com/arpyph1/productimpactpod-site/blob/main/scripts/publishing/validate_article.py)
- [generate_hero_image.py](https://github.com/arpyph1/productimpactpod-site/blob/main/scripts/publishing/generate_hero_image.py)
- [dispatch_rebuild.py](https://github.com/arpyph1/productimpactpod-site/blob/main/scripts/publishing/dispatch_rebuild.py)
- [verify_supabase.py](https://github.com/arpyph1/productimpactpod-site/blob/main/scripts/publishing/verify_supabase.py)
- [README.md (integration patterns)](https://github.com/arpyph1/productimpactpod-site/blob/main/scripts/publishing/README.md)

### 6.1 `validate_article.py`

Blocks publishes that would break SEO or break the Astro build.

#### Interface — as Python module

```python
from validate_article import validate, has_errors, Issue

article: dict = {
    "slug": "example-slug",
    "title": "Example Article",
    "meta_description": "...",
    "format": "news-brief",
    "themes": ["ai-product-strategy"],
    "author_slugs": ["arpy-dragffy"],
    "publish_date": "2026-04-16",
    "canonical_url": "https://productimpactpod.com/news/example-slug",
    "content_markdown": "Lead paragraph...\n\n## First H2...",
    "content_html": "<p>Lead paragraph...</p>\n<h2>First H2</h2>...",
    # ... plus all other frontmatter fields
}

issues: list[Issue] = validate(article)
if has_errors(issues):
    for issue in issues:
        print(issue)   # e.g. ✗ [meta_description] 94 chars — below recommended 120 minimum
    raise ValueError(f"{article['slug']!r} blocked by validation")
```

Each `Issue` has `severity` (`"error"` | `"warn"`), `field`, and `message`.
Only `error` severity blocks — warnings print but don't fail.

#### Interface — as CLI

```bash
# Read article JSON from stdin
python3 validate_article.py < article.json

# Or from a file
python3 validate_article.py --file article.json

# Exit code 0 = passing, 1 = errors present, 2 = usage / JSON parse failure
```

#### What it checks (12 rules)

| Check | Failure mode |
|---|---|
| `slug` | Error if missing, malformed (spaces, uppercase, underscores), or >100 chars |
| `title` | Error if <10 chars; warn if >100 |
| `meta_description` | Error if >170 chars or missing; warn if <120 |
| `format` | Error if not in canonical 10 |
| `themes` | Error if empty or any value outside canonical 8; warn if >3 |
| `canonical_url` | Error if missing, doesn't start with `https://productimpactpod.com`, or doesn't match `/news/{slug}` |
| `author_slugs` | Error if empty; errors per invalid slug format |
| `publish_date` | Error if missing or not `YYYY-MM-DD` |
| `content` | Error if both `content_markdown` and `content_html` are empty; warn if `content_html` starts with `<h1>` |
| `hero_image_url` | Warn if missing; error if non-absolute |
| `overview_bullets` | Warn if <3 or >5 items |
| `topics` | Error per invalid slug format |

### 6.2 `generate_hero_image.py`

Generates a photographic, text-free hero image from article context
using Claude for prompt distillation and Flux 1.1 Pro for rendering.
Uploads to Supabase Storage and returns the public URL.

#### Editorial style constraints (baked into the system prompt)

- **Documentary photojournalism aesthetic** — natural light, 35mm prime,
  shallow DoF, muted colour grade, fine grain
- **No text, logos, signage, watermarks** in the image
- **Zero or one person max** — system prompt instructs Claude to prefer
  scenes with NO people; if the article is about a person, photograph
  their workspace or tool instead (avoids uncanny-face artefacts)
- **No futuristic/sci-fi/cyberpunk/neon/robotic tells**
- **No CGI/illustration/cartoon aesthetics**
- Negative prompt blocks extra fingers, warped anatomy, floating objects

#### Interface — as Python module

```python
from generate_hero_image import generate as generate_hero

result = generate_hero(
    article,                    # the full article dict (needs slug, title,
                                # subtitle, meta_description, themes[0])
    out_path=None,              # if set, saves locally and skips upload
                                # (useful for human review before publish)
)

# result: GenerateResult(
#     prompt="A photograph of...  [editorial style locked on]",
#     image_url="https://pgsljoqwfhufubodlqjk.supabase.co/storage/v1/object/public/article-heroes/<slug>.png",
#     model="black-forest-labs/flux-1.1-pro",
#     elapsed_s=28.4,
# )

article["hero_image_url"] = result.image_url
article["hero_image_alt"] = f"Editorial photograph: {article['title']}"
article["hero_image_credit"] = "Generated via Flux 1.1 Pro"
```

#### Interface — as CLI

```bash
# Upload to Supabase and print URL
python3 generate_hero_image.py < article.json
# Prints URL on stdout, metadata on stderr

# Save locally (skips upload — for review)
python3 generate_hero_image.py --file article.json --out /tmp/hero.png
```

#### Required env vars

```
ANTHROPIC_API_KEY        — prompt distillation (Claude Opus 4.6)
REPLICATE_API_TOKEN      — image rendering (Flux 1.1 Pro)
PUBLIC_SUPABASE_URL      — Storage endpoint
SUPABASE_SERVICE_ROLE_KEY — Storage upload (bypasses RLS)
```

#### Cost

- Flux 1.1 Pro: ~$0.04/image, renders in 15–30s
- Claude distillation: ~100 output tokens, fractions of a cent
- **Total per article: ~$0.05, ~30s wall-clock**

#### Common failure modes

| Failure | Cause |
|---|---|
| `"ANTHROPIC_API_KEY not set"` | Env var missing |
| `"REPLICATE_API_TOKEN not set"` | Env var missing |
| `"Image generation timed out"` | Replicate took >3min (rare) — retry |
| `"Supabase upload HTTP 404"` | `article-heroes` bucket doesn't exist (it does, just check) |
| `"Supabase upload HTTP 401"` | Service role key wrong or expired |
| `"article.slug required"` | Called without a slug in the dict |

### 6.3 `dispatch_rebuild.py`

Fires a GitHub `repository_dispatch` event of type `content-published`
that triggers the site's `.github/workflows/publish-trigger.yml`, which
in turn pings the Cloudflare Pages deploy hook.

#### Interface — as Python module

```python
from dispatch_rebuild import dispatch

ok, message = dispatch({
    "articleSlug": article["slug"],        # optional client_payload — shows up
    "batchCount": 1,                        # in the GitHub Actions run log
})
if not ok:
    log.warning(f"dispatch failed (non-fatal): {message}")
    # The site won't auto-rebuild. Trigger manually from:
    # https://github.com/arpyph1/productimpactpod-site/actions
```

#### Interface — as CLI

```bash
# Fire with no payload
python3 dispatch_rebuild.py

# Fire with custom payload (shows in GitHub Actions run context)
python3 dispatch_rebuild.py --payload '{"articleSlug":"foo","count":1}'
```

#### Required env var

```
GITHUB_TOKEN       — PAT with `repo` scope on arpyph1/productimpactpod-site
                     (or GH_TOKEN as fallback)
```

Create one at https://github.com/settings/tokens → **Generate new token
(classic)** → tick `repo` scope → set expiration to 1 year.

#### Batching

**Call dispatch ONCE at the end of a batch**, not once per article. CF
Pages queues one build regardless of concurrent triggers; extra dispatches
just clutter the Actions log.

```python
def publish_batch(md_paths: list[Path]):
    successes = []
    for path in md_paths:
        if publish_one(path):
            successes.append(path)

    if successes:
        dispatch({"count": len(successes)})    # one call for the whole batch
```

#### Verification

```bash
# Check the workflow actually fired
open https://github.com/arpyph1/productimpactpod-site/actions
# → "Cloudflare Pages rebuild" workflow → should show a recent run
```

---

## 7. `verify_supabase.py` — environment diagnostic

Not part of the publish flow. Run it **once** before first publish and
**after any schema change or credential rotation** to catch configuration
drift.

#### Interface

```bash
# Requires PUBLIC_SUPABASE_URL + PUBLIC_SUPABASE_ANON_KEY at minimum
export PUBLIC_SUPABASE_URL="https://pgsljoqwfhufubodlqjk.supabase.co"
export PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."   # optional — enables Storage check

python3 verify_supabase.py --verbose
```

#### What it checks (all read-only, makes no writes)

1. **Environment variables** — 7 required + optional vars with expected formats
2. **REST table access** — anon SELECT on articles, entities, article_entities, themes, episode_shownotes (distinguishes 404 from RLS-blocked 403)
3. **Theme seed** — all 8 canonical slugs present
4. **Host entity rows** — arpy-dragffy and brittany-hobbs exist
5. **Storage bucket** — `article-heroes` exists and is public (requires service role key)
6. **Edge function** — `get-latest-short` deployed and YOUTUBE_API_KEY secret set

#### Expected output when green

```
Verifying https://pgsljoqwfhufubodlqjk.supabase.co…

Environment variables
  ✓ PUBLIC_SUPABASE_URL: https://pgsljoqwfhufubodlqjk.supabase.co
  ✓ PUBLIC_SUPABASE_ANON_KEY: set (208 chars)
  ...
Supabase tables (REST / RLS anon reads)
  ✓ articles: table exists (no rows or RLS-filtered empty)
  ✓ entities: 1 row accessible
  ...
Host entity rows
  ✓ /people/arpy-dragffy: found: Arpy Dragffy
  ✓ /people/brittany-hobbs: found: Brittany Hobbs

Supabase Storage (article-heroes bucket)
  ✓ article-heroes bucket: exists and is public

Supabase Edge Functions
  ✓ get-latest-short: deployed, returned 1 shorts + mostWatched

✓ All checks passed — site is ready to publish.
```

#### macOS SSL certificate gotcha

Python on macOS often ships without root certs installed. If you see:

```
[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate
```

Fix with:

```bash
pip3 install certifi
export SSL_CERT_FILE=$(python3 -c "import certifi; print(certifi.where())")
```

Add that export to `~/.zshrc` / `~/.bashrc` for persistence. This affects
`verify_supabase.py` and any other stdlib `urllib` code — `curl` is
unaffected because it uses the system cert store.

---

## 8. Setup workflow — connecting vault-system to the site

Four discrete operations, each committed separately. Total time ~15 min.

### 8.1 Prerequisites

On the machine running this session:

- **Git** — any recent version
- **Python 3.9+** — `python3 --version`
- **macOS only:** `pip3 install certifi` — the stdlib urllib in macOS
  Python installs often can't verify Supabase's SSL cert without this
  (see section 9 for the `SSL_CERT_FILE` env var)
- You are inside the `vault-system` repo root (not a subdirectory)
- Running `git status` shows a clean working tree

Verify:

```bash
cd ~/code/vault-system      # adjust to your actual path
git status                  # should say "nothing to commit, working tree clean"
python3 --version           # should print 3.9 or higher
```

### 8.2 Add the site repo as a submodule

```bash
git submodule add https://github.com/arpyph1/productimpactpod-site \
  product-impact/scripts/site
```

This creates:

```
vault-system/
├── .gitmodules                          (new — submodule registry)
└── product-impact/
    └── scripts/
        └── site/                        (full checkout of productimpactpod-site)
            ├── scripts/publishing/
            │   ├── validate_article.py
            │   ├── generate_hero_image.py
            │   ├── dispatch_rebuild.py
            │   ├── verify_supabase.py
            │   └── README.md
            ├── vault-integration/
            │   ├── scaffold-vault.sh
            │   ├── article-template.md
            │   ├── brief-template.md
            │   ├── publish_articles.py.template
            │   ├── vault-folder-structure.md
            │   └── README.md
            └── (rest of the site repo)
```

Verify the submodule contents are present:

```bash
ls product-impact/scripts/site/scripts/publishing/
# Should list: validate_article.py  generate_hero_image.py
#              dispatch_rebuild.py  verify_supabase.py  README.md

ls product-impact/scripts/site/vault-integration/
# Should list: scaffold-vault.sh  article-template.md  brief-template.md
#              publish_articles.py.template  README.md  vault-folder-structure.md
```

### 8.3 Run the scaffold script

```bash
bash product-impact/scripts/site/vault-integration/scaffold-vault.sh
```

Expected output:

```
Scaffolding .../product-impact…
  + .../product-impact/pre-production/sources/2026-04
  + .../product-impact/pre-production/sources/by-topic
  + .../product-impact/pre-production/episodes
  + .../product-impact/pre-production/briefs
  + .../product-impact/drafts
  + .../product-impact/published/2026/04
  + .../product-impact/taxonomy
  + .../product-impact/scripts/utils
  + .../product-impact/drafts/_TEMPLATE.md
  + .../product-impact/pre-production/briefs/_TEMPLATE.md
  + .../product-impact/scripts/publish_articles.py
  + .../product-impact/README.md
  + .../product-impact/.gitignore

✓ Done — 13 created, 0 already existed

Next steps:
  1. cd <vault root>
  2. Review product-impact/scripts/publish_articles.py and customise for your vault parser
  3. Copy the env vars you need to product-impact/.env (gitignored)
  4. Run: python3 product-impact/scripts/site/scripts/publishing/verify_supabase.py
  5. git add product-impact/ && git commit -m 'scaffold: product-impact folder structure'
```

The script is **idempotent** — safe to re-run. It only creates missing
files, never overwrites existing ones. If it reports `0 created, 13
already existed` you've already run it.

### 8.4 Commit the submodule + scaffold

```bash
git add .gitmodules product-impact/
git commit -m "chore: wire product-impact publishing pipeline

- Add productimpactpod-site as submodule at product-impact/scripts/site
- Scaffold pre-production/drafts/published folder structure
- Drop in starter templates: _TEMPLATE.md, publish_articles.py, README"

git push
```

At this point, `vault-system/product-impact/` has the full structure
needed to author and publish articles. The `publish_articles.py` file
is a starter template with one `NotImplementedError` you'll replace in
the next section.

### 8.5 What got created

| Path | Purpose |
|---|---|
| `.gitmodules` | Tells git where the submodule lives and what commit to pin |
| `product-impact/scripts/site/` | The checked-out submodule (site repo) |
| `product-impact/pre-production/sources/YYYY-MM/` | Current-month folder for press releases, scraped research |
| `product-impact/pre-production/sources/by-topic/` | Long-term topic research folders |
| `product-impact/pre-production/episodes/` | Podcast recording artefacts |
| `product-impact/pre-production/briefs/` | One-paragraph editorial plans |
| `product-impact/pre-production/briefs/_TEMPLATE.md` | Brief starter |
| `product-impact/drafts/` | Articles in progress |
| `product-impact/drafts/_TEMPLATE.md` | Full YAML frontmatter template (copy this to start a new article) |
| `product-impact/published/YYYY/MM/` | Archive folder for articles that have gone live |
| `product-impact/taxonomy/` | Cached canonical lists (themes.json, formats.json) — optional |
| `product-impact/scripts/publish_articles.py` | Main orchestrator (starter — customise in section 10) |
| `product-impact/scripts/utils/` | For your vault-specific helpers |
| `product-impact/.gitignore` | Excludes `.env`, `*.wav`, `__pycache__/`, etc. |
| `product-impact/README.md` | Workflow overview (brief version — this doc is the full one) |

### 8.6 Updating the submodule later

When the site repo gets new features (new validator check, new image
model, taxonomy change, etc.) — update the pin:

```bash
cd product-impact/scripts/site
git pull origin main
cd -

git add product-impact/scripts/site
git commit -m "chore: bump site submodule to $(cd product-impact/scripts/site && git rev-parse --short HEAD)"
git push
```

Anyone cloning vault-system fresh needs `--recursive`:

```bash
git clone --recursive https://github.com/arpyph1/vault-system.git
# or, if they already cloned without --recursive:
cd vault-system
git submodule update --init --recursive
```

---

*Next: Section 9 covers every environment variable the publish pipeline
uses — where each comes from, where to store them, and how to source them.*

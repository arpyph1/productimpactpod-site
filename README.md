# productimpactpod.com

The publication platform for Product Impact Podcast. Built on Astro + Tailwind + Supabase + Cloudflare Pages.

**Live site:** https://productimpactpod.com  
**Admin CMS:** https://productimpactpod.com/admin

## Stack

| Layer | Tool |
|---|---|
| Framework | Astro 5 (SSG, React islands for admin) |
| Styling | Tailwind CSS 3 |
| Database | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Hosting | Cloudflare Pages |
| CI/CD | GitHub Actions (typecheck + build on push to main) |
| Email/Newsletter | Substack (external, form redirects to Substack subscribe) |
| Podcast RSS | Anchor/Spotify (synced to Supabase every 6 hours) |
| YouTube Shorts | Supabase Edge Function calling YouTube Data API v3 |

## Local development

```bash
cp .env.example .env
# Edit .env with your Supabase credentials (see .env.example for details)
npm install
npm run dev
```

Site runs at `http://localhost:4321`.

## Environment variables

### Required for local dev and build (`.env`)

| Variable | Source | Used by |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Supabase Dashboard > Settings > API | Astro build, all pages |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API | Astro build, all pages |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > Settings > API (Reveal) | Python scripts only |

### Required in Cloudflare Pages (production)

Set in Cloudflare Pages > Settings > Variables and Secrets:

| Variable | Value |
|---|---|
| `PUBLIC_SUPABASE_URL` | `https://pgsljoqwfhufubodlqjk.supabase.co` |
| `PUBLIC_SUPABASE_ANON_KEY` | Your anon key |

### Required in GitHub Actions (secrets)

| Secret | Used by |
|---|---|
| `SUPABASE_URL` | sync-episodes.yml, populate_theme_data.py, tag_data_reports.py |
| `SUPABASE_SERVICE_ROLE_KEY` | All sync/tagging scripts |
| `PRODUCT_IMPACT_SHOWNOTES_API_KEY` | sync_episodes_to_supabase.py (optional) |

### Required in Supabase Edge Function Secrets

| Secret | Used by |
|---|---|
| `YOUTUBE_API_KEY` | get-latest-short edge function |
| `CLOUDFLARE_API_TOKEN` | trigger-deploy edge function |
| `CLOUDFLARE_ACCOUNT_ID` | trigger-deploy edge function |

## Route structure

```
/                              Homepage (configurable sections via admin)
/news                          News index with format filter tabs
/news/[slug]                   Article page (canonical URL)
/news/format/[format]          Filtered by format (feature, data-reports, etc.)
/news/page/[page]              Paginated news
/news/archive                  Date-based archive
/themes                        Themes grid
/themes/[slug]                 Theme hub (articles, episodes, entities, related themes)
/podcast                       Podcast homepage (episodes, YouTube Shorts, hosts, sponsors)
/episodes                      Episode browser with theme/focus filters
/episodes/[slug]               Episode detail page
/partnerships                  Sponsor portal
/admin                         CMS (auth via Supabase Magic Link)
/about                         Editorial standards, masthead, policies
/contact                       Contact channels
/privacy                       Privacy policy
/terms                         Terms of service
/concepts/[slug]               Concept entity page
/people/[slug]                 Person entity page
/organizations/[slug]          Organization entity page
/products/[slug]               Product entity page
/frameworks/[slug]             Framework entity page
/sources/[slug]                Source entity page
/sitemap.xml                   Sitemap index (wraps sitemap-0.xml + news-sitemap.xml)
/news-sitemap.xml              Google News sitemap (30-day rolling window)
/rss.xml                       Main RSS feed (excerpts, last 50 articles)
/news/rss.xml                  Full-content RSS feed (all articles, media tags)
/podcast/rss.xml               Redirect to Anchor RSS
/robots.txt                    Crawler allow-list (all major bots + LLM crawlers)
/llms.txt                      LLM crawler hints and feed discovery
```

## Article formats

| Slug | Label | Description |
|---|---|---|
| `news-brief` | News Brief | Short news items |
| `news-analysis` | News Analysis | In-depth news analysis |
| `release-note` | Release | Product releases and launches |
| `feature` | Feature | Long-form feature stories |
| `data-reports` | Data & Reports | Research reports, surveys, benchmarks, statistical analysis |
| `case-study` | Case Study | Implementation case studies |
| `opinion` | Opinion | Opinion and commentary |
| `explainer` | Explainer | Definitional "What is X" articles |
| `product-review` | Product Review | Hands-on product reviews |
| `research-brief` | Research Brief | Academic/research summaries |

## Themes (8 canonical)

| Slug | Name |
|---|---|
| `ai-product-strategy` | AI Product Strategy |
| `adoption-organizational-change` | Adoption & Organizational Change |
| `agents-agentic-systems` | Agents & Agentic Systems |
| `data-semantics-knowledge-foundations` | Data, Semantics & Knowledge Foundations |
| `evaluation-benchmarking` | Evaluation & Benchmarking |
| `go-to-market-distribution` | Go-to-Market & Distribution |
| `governance-risk-trust` | Governance, Risk & Trust |
| `ux-experience-design-for-ai` | UX & Experience Design for AI |

## Admin CMS (`/admin`)

Accessible to `@ph1.ca` and `@productimpactpod.com` email addresses via Supabase Magic Link.

| Tab | Features |
|---|---|
| **Settings** | Site identity, nav items, platform links, custom CSS/HTML |
| **SEO** | Google/Bing verification codes, default meta tags |
| **Homepage** | Hero carousel config, lead stories, section ordering with drag-to-reorder, theme/format filters per section, evergreen carousel, copy editing |
| **Articles** | Full article CRUD with WYSIWYG editor, image paste upload, format/theme/topic management, publish/draft toggle |
| **Resources** | Downloadable reports and guides |
| **Podcast** | Hero tagline/description, host bios, platform URLs, episode management |
| **Partners** | Sponsor management |
| **Social** | AI-generated LinkedIn/Twitter posts per article with three voice options (Product Impact, Arpy, Brittany) |

### Homepage sections (admin-configurable)

| Section | Type | Configurable |
|---|---|---|
| Hero Carousel | Carousel | Mode (latest/lead/manual), interval, max slides |
| Latest Articles | Vertical list | Theme filter, format filter |
| Podcast Episodes | Special | Fixed data source (RSS) |
| Carousel 2 | Carousel | Label, theme filter, format filter |
| Vertical List 2 | Vertical list | Label, theme filter, format filter |
| Featured Reading | Carousel | Label, manually selected articles |
| AI Strategy Resources | Special | Fixed (CMS resources) |
| Newsletter / Substack | Special | Heading text, Substack editions |
| Partners | Special | Fixed (partner data) |

All sections can be toggled on/off and reordered via drag-and-drop.

## Scripts

All scripts auto-load credentials from `.env` in the project root.

| Script | Purpose | Schedule |
|---|---|---|
| `scripts/sync_episodes_to_supabase.py` | Sync podcast RSS feed to Supabase | Every 6 hours (GitHub Action) |
| `scripts/populate_theme_data.py` | Auto-tag entities and episodes with themes | Every 6 hours (GitHub Action) |
| `scripts/tag_data_reports.py` | Auto-tag articles as "Data & Reports" format | Every 6 hours (GitHub Action) |
| `scripts/migrate_interview_to_data_reports.py` | One-time migration from interview to data-reports format | Manual |
| `scripts/publishing/validate_article.py` | Pre-publish validation (SEO, format, themes) | Called by publish pipeline |
| `scripts/publishing/generate_hero_image.py` | AI hero image generation via Flux | Manual |
| `scripts/publishing/dispatch_rebuild.py` | Trigger Cloudflare rebuild via GitHub dispatch | Manual |

### Running scripts locally

```bash
# One-time setup
cp .env.example .env
# Edit .env with your Supabase credentials

# Then run any script directly — no exports needed
python3 scripts/tag_data_reports.py
python3 scripts/populate_theme_data.py
python3 scripts/sync_episodes_to_supabase.py
```

## Supabase Edge Functions

| Function | Purpose | Secrets needed |
|---|---|---|
| `get-latest-short` | Fetch latest YouTube Shorts for /podcast page | `YOUTUBE_API_KEY` |
| `trigger-deploy` | Trigger Cloudflare Pages rebuild from admin | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

Deploy with:
```bash
supabase login
supabase link --project-ref pgsljoqwfhufubodlqjk
supabase functions deploy get-latest-short
supabase functions deploy trigger-deploy
```

## GitHub Actions workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push to main, PRs | Typecheck + build verification |
| `sync-episodes.yml` | Every 6 hours + manual | Sync RSS, populate themes, tag data-reports |
| `scheduled-rebuild.yml` | Every 6 hours | Trigger Cloudflare Pages rebuild |
| `publish-trigger.yml` | Repository dispatch | Trigger rebuild after article publish |

## SEO and indexing

Every page includes:
- Server-rendered `<title>`, `<meta description>`, `<link rel="canonical">`
- Open Graph tags (`og:type`, `og:title`, `og:description`, `og:image`, `article:*`)
- Twitter Card (`summary_large_image`)
- NewsArticle JSON-LD + BreadcrumbList JSON-LD
- NewsMediaOrganization schema (editorial policies, contact points)
- Google/Bing verification meta tags (configured in admin SEO screen)

### Aggregator submissions

| Platform | Status | Feed |
|---|---|---|
| Google News | Submitted via Publisher Center | `/news-sitemap.xml` |
| Bing News | Submit via Bing PubHub | `/news/rss.xml` |
| Flipboard | Submit at flipboard.com/publishers | `/news/rss.xml` |
| Apple News | Requires Apple Developer Program ($99/year) | `/news/rss.xml` |
| Techmeme | Manual pitch to tips@techmeme.com | Organic crawling |

### Crawler access

`robots.txt` explicitly allows: Googlebot, Bingbot, DuckDuckBot, GPTBot, ClaudeBot, PerplexityBot, Applebot, Amazonbot, CCBot, Bytespider, FacebookBot, Twitterbot, LinkedInBot, Slackbot, Discordbot, TelegramBot, WhatsApp.

## Deployment — Cloudflare Pages

**Project:** `productimpactpod-site` on Cloudflare Pages  
**Production branch:** `main`  
**Build command:** `npm install && npm run build`  
**Build output:** `dist`  
**Domains:** `productimpactpod.com`, `www.productimpactpod.com`, `productimpactpod-site.pages.dev`

Pushes to `main` auto-trigger Cloudflare Pages builds. The admin "Rebuild & Deploy" button triggers builds via the `trigger-deploy` Supabase edge function.

## Troubleshooting

**Build fails with "Could not find Supabase URL"**  
Copy `.env.example` to `.env` and fill in `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.

**Scripts fail with HTTP 401**  
Check that `SUPABASE_SERVICE_ROLE_KEY` in `.env` is the service_role key (not the anon key). Get it from Supabase Dashboard > Settings > API > Reveal.

**"Rebuild & Deploy" fails in admin**  
Verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set in Supabase Edge Function Secrets. Verify the `trigger-deploy` function is deployed (`supabase functions deploy trigger-deploy`).

**YouTube Shorts not updating on /podcast**  
Verify `YOUTUBE_API_KEY` is set in Supabase Edge Function Secrets. Verify the `get-latest-short` function is deployed. Shorts refresh on every site rebuild.

**GitHub Action sync fails**  
Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets are set in GitHub repo Settings > Secrets and variables > Actions. Note: the GitHub secret is `SUPABASE_URL` (not `PUBLIC_SUPABASE_URL`).

**Theme pages show placeholder text**  
Run `python3 scripts/populate_theme_data.py` to tag entities and episodes with themes. Placeholder text in `long_form_intro` is stripped automatically at build time.

**Data & Reports page is empty**  
Run `python3 scripts/tag_data_reports.py` to auto-tag qualifying articles. Then trigger a site rebuild.

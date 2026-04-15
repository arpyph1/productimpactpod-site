---
# ── REQUIRED ────────────────────────────────────────────────────────────────
# Lowercase, hyphen-separated. Must match the filename (without .md) and
# become the final segment of /news/{slug}.
slug: example-article-slug

# 10–100 chars. Aim for ≤70 to avoid SERP truncation.
title: Descriptive headline that tells the reader what happened

# Optional deck / standfirst. 1–2 sentences.
subtitle: null

# One of: news-brief, news-analysis, release-note, feature, interview,
# case-study, opinion, explainer, product-review, research-brief
format: news-analysis

# Slug array. Must have at least one; must match entities table person slugs
# (or host slugs 'arpy-dragffy' / 'brittany-hobbs' which are always valid).
author_slugs:
  - arpy-dragffy

# ISO 8601 date. Must NOT be in the future at publish time.
publish_date: 2026-04-15

# 120–170 chars. Google News SERP descriptor. Write for click-through.
meta_description: |
  A clear, click-worthy summary of the article in 120-170 characters. This
  is what shows up in Google News, social unfurls, and RSS readers.

# Must be subset of the canonical 8 themes.
# Assign 1-3. First theme drives theme-colour fallback for hero gradient.
themes:
  - ai-product-strategy
  - agents-agentic-systems

# Free-form per-article tags. Each becomes a /topics/{slug} hub.
# Used for long-tail SEO (e.g. "claude", "enterprise-ai").
topics:
  - claude
  - anthropic
  - managed-agents

# Optional: which editorial lens(es) does the piece use?
# (Free array; not constrained to a canonical enum — but stick to your
# house style.)
lenses:
  - strategic
  - technical

# MUST start with https://productimpactpod.com/news/ and end with the slug.
canonical_url: https://productimpactpod.com/news/example-article-slug

# ── OPTIONAL (auto-filled if missing) ───────────────────────────────────────

# Hero image. If null, generate_hero_image.py creates one from the article
# context using Flux 1.1 Pro and uploads to Supabase Storage.
hero_image_url: null
hero_image_alt: null
hero_image_credit: null

# TL;DR bullets shown in the Overview box above the article body.
# Aim for 3-5. If null, the Astro template extracts them from H2 sections.
overview_bullets: null

# Reading metadata. Omit — the publish script computes these from word count.
read_time_minutes: null
word_count: null

# Byline role (e.g. "Senior Analyst"). Displayed under author name.
byline_role: null

# Dateline (e.g. "San Francisco"). Traditional news convention.
dateline: null

# Link to related podcast episode, if any.
primary_podcast_episode_guid: null

# Custom JSON-LD. Leave null unless you need to override the auto-generated
# NewsArticle schema.
schema_jsonld: null

# Published flag. publish_articles.py sets this to true AFTER all validation
# and upload steps succeed. Keep as false in drafts.
published: false
---

# (The H1 here will be stripped by the Astro template — it renders its own
#  H1 from the `title` frontmatter field. Start the body with a lead paragraph
#  or an H2 section instead.)

Lead paragraph. This is the opening hook — usually 2-3 sentences that
establish stakes and point the reader at why this matters. Don't bury the
lede.

## First H2 — substantive section heading

Body paragraphs. Markdown is rendered by the publish pipeline into
`content_html` before the INSERT. Use standard markdown throughout —
**bold**, *italic*, [links](https://example.com), `inline code`, block
quotes, ordered/unordered lists, and fenced code blocks all work.

> Pull-quotes render with a coral left border in the article template.
> Use them sparingly for punchy quotes from interview subjects or to
> highlight a key claim.

### Subsection H3 (optional)

Subsections are fine but keep the hierarchy flat — most articles should
stick to H2 as the primary section divider.

## Second H2

Continue the narrative. If you're writing a news-analysis, this is often
where you bring in the counter-perspective or alternative framing.

### What this means for product teams

A common pattern: end each section with a practical "so what" that ties
back to what the reader can actually do with this information.

## Sources

If you want an explicit sources list (not all articles need one), include
it as the final section. Primary sources, research papers, and company
announcements should all be linked inline via markdown link syntax — this
is captured by our `content_html` and becomes crawlable.

- [Primary source 1](https://example.com/primary-source)
- [Original research paper](https://arxiv.org/abs/…)
- [Company announcement](https://company.com/blog/…)

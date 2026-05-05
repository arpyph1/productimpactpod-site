// Supabase client for server-side queries at build time.
// Uses the anon key (public) — all reads go through RLS-protected GET endpoints.
// Writes are handled by the existing publish_articles.py pipeline, not the site.

import { createClient } from "@supabase/supabase-js";

// Both values come from the Cloudflare Pages build environment (set in
// Pages → Settings → Environment variables). No hardcoded fallback — we
// want a loud build failure if the env is misconfigured rather than the
// site silently pointing at the wrong project.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY must be set. " +
    "Copy .env.example to .env for local dev, or configure in the " +
    "Cloudflare Pages dashboard for production.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
});

// ── Types ────────────────────────────────────────────────────────────────────

// Columns fetched in list/bulk contexts. Excludes content_html, content_markdown,
// and schema_jsonld — the three largest fields, averaging 50-200 KB per article.
// getArticleBySlug() and getAllArticlesWithContent() still use SELECT * for the
// two cases that genuinely need full content.
const ARTICLE_SUMMARY_COLS = [
  "id", "slug", "title", "subtitle", "format", "author_slugs",
  "byline_role", "dateline", "publish_date", "last_updated",
  "read_time_minutes", "word_count", "meta_description",
  "hero_image_url", "hero_image_alt", "hero_image_credit",
  "themes", "lenses", "topics", "people", "organizations", "products",
  "primary_podcast_episode_guid", "canonical_url", "published",
  "is_lead_story", "overview_bullets", "created_at", "updated_at",
].join(", ");

export type ArticleFormat =
  | "news-brief"
  | "news-analysis"
  | "release-note"
  | "feature"
  | "data-reports"
  | "case-study"
  | "opinion"
  | "explainer"
  | "product-review"
  | "research-brief"
  | "playbook";

export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  format: ArticleFormat;
  formats: ArticleFormat[];
  author_slugs: string[];
  byline_role: string | null;
  dateline: string | null;
  publish_date: string;
  last_updated: string | null;
  read_time_minutes: number | null;
  word_count: number | null;
  meta_description: string;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  hero_image_credit: string | null;
  content_markdown: string;
  content_html: string;
  themes: string[];
  lenses: string[];
  topics: string[];
  // AI-generated, fine-grained labels powering /tags and on-site search.
  // Not displayed on the article template; surfaced via meta keywords.
  tags: string[];
  // Legacy optional fields — not selected in listing queries; undefined at runtime.
  people?: string[];
  organizations?: string[];
  products?: string[];
  primary_podcast_episode_guid: string | null;
  schema_jsonld: Record<string, unknown> | null;
  canonical_url: string;
  published: boolean;
  is_lead_story: boolean;
  overview_bullets: string[] | null;
  created_at: string;
  updated_at: string;
}

export type ArticleSummary = Article;

export interface Entity {
  id: string;
  type: "concept" | "person" | "organization" | "framework" | "source" | "product";
  slug: string;
  name: string;
  aliases: string[];
  description: string | null;
  long_form: string | null;
  external_links: Array<{ label: string; url: string }>;
  metadata: Record<string, unknown>;
  themes: string[];
  lenses: string[];
  canonical_url: string;
  schema_jsonld: Record<string, unknown> | null;
}

export interface Theme {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  long_form_intro: string | null;
  meta_description: string | null;
  target_search_queries: string[] | null;
  schema_jsonld: Record<string, unknown> | null;
  hero_image_url: string | null;
  theme_color: string | null;
  icon: string | null;
}

export interface Episode {
  episode_guid: string;
  slug: string | null;
  title: string;
  content_html: string;
  meta_description: string | null;
  episode_number: number | null;
  season_number: number | null;
  duration: string | null;
  themes: string[];
  lenses: string[];
  hosts: string[];
  guests: Array<{ name: string; role?: string; linkedin?: string; website?: string }>;
  transcript_markdown: string | null;
  schema_jsonld: Record<string, unknown> | null;
  published_at: string | null;
  links: Array<{ label: string; url: string }> | null;
  video_urls: string[] | null;
  published: boolean;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

import heroImageMap from "../data/hero-image-map.json";

function rewriteHeroUrl(url: string | null): string | null {
  if (!url) return null;
  const mapped = (heroImageMap as Record<string, string>)[url];
  return mapped ?? url;
}

// Columns that listing pages need. Critically excludes content_html and
// content_markdown, which are by far the largest fields and only the
// /news/[slug] detail page actually consumes them. Dropping them from
// the listing query cuts Supabase egress per build by roughly an order
// of magnitude on a typical archive.
const ARTICLE_LIST_COLUMNS = [
  "id",
  "slug",
  "title",
  "subtitle",
  "format",
  "formats",
  "author_slugs",
  "byline_role",
  "dateline",
  "publish_date",
  "last_updated",
  "read_time_minutes",
  "word_count",
  "meta_description",
  "hero_image_url",
  "hero_image_alt",
  "hero_image_credit",
  "themes",
  "lenses",
  "topics",
  "tags",
  "primary_podcast_episode_guid",
  "schema_jsonld",
  "canonical_url",
  "published",
  "is_lead_story",
  "overview_bullets",
  "created_at",
  "updated_at",
].join(",");

// Build-time memoization. Astro evaluates each .astro page in the same
// Node process during `astro build`, so a top-level promise cache is
// shared across every getStaticPaths/frontmatter call within a single
// build. Without this, 17+ templates each re-fetched the full archive
// from Supabase, multiplying egress by the call count.
let _articlesCache: Promise<ArticleSummary[]> | null = null;

export async function getAllArticles(): Promise<ArticleSummary[]> {
  if (_articlesCache) return _articlesCache;
  _articlesCache = (async () => {
    const { data, error } = await supabase
      .from("articles")
      .select(ARTICLE_LIST_COLUMNS)
      .eq("published", true)
      .order("publish_date", { ascending: false });
    if (error) {
      console.error("getAllArticles error:", error);
      return [];
    }
    return ((data ?? []) as unknown as Article[]).map(a => ({
      ...a,
      hero_image_url: rewriteHeroUrl(a.hero_image_url),
    }));
  })();
  return _articlesCache;
}

// Full-content variant — only for the /news/rss.xml full-text feed.
// All other callers should use getAllArticles().
export async function getAllArticlesWithContent(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .order("publish_date", { ascending: false });
  if (error) {
    console.error("getAllArticlesWithContent error:", error);
    return [];
  }
  return ((data ?? []) as Article[]).map(a => ({
    ...a,
    hero_image_url: rewriteHeroUrl(a.hero_image_url),
  }));
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (error) {
    console.error("getArticleBySlug error:", error);
    return null;
  }
  const article = data as Article;
  article.hero_image_url = rewriteHeroUrl(article.hero_image_url);
  return article;
}

export async function getRelatedArticles(
  article: Article,
  limit = 3,
): Promise<ArticleSummary[]> {
  if (!article.themes || article.themes.length === 0) {
    const { data } = await supabase
      .from("articles")
      .select(ARTICLE_SUMMARY_COLS)
      .eq("published", true)
      .neq("slug", article.slug)
      .order("publish_date", { ascending: false })
      .limit(limit);
    return (data ?? []) as unknown as ArticleSummary[];
  }
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SUMMARY_COLS)
    .eq("published", true)
    .neq("slug", article.slug)
    .overlaps("themes", article.themes)
    .order("publish_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRelatedArticles error:", error);
    return [];
  }
  return (data ?? []) as unknown as ArticleSummary[];
}

/**
 * Aggregate the unique set of topic slugs used across all published articles.
 * Topics are per-article free-form tags; this is the index used to enumerate
 * static paths for /topics/[slug].
 */
export async function getAllTopics(): Promise<
  Array<{ slug: string; count: number; firstSeen: string }>
> {
  const articles = await getAllArticles();
  const counter = new Map<string, { count: number; firstSeen: string }>();
  for (const a of articles) {
    for (const topic of a.topics ?? []) {
      const prev = counter.get(topic);
      if (prev) {
        prev.count++;
        if (a.publish_date < prev.firstSeen) prev.firstSeen = a.publish_date;
      } else {
        counter.set(topic, { count: 1, firstSeen: a.publish_date });
      }
    }
  }
  return [...counter.entries()]
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.count - a.count); // most-covered first
}

export async function getArticlesByTopic(
  topicSlug: string,
  limit = 50,
): Promise<ArticleSummary[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SUMMARY_COLS)
    .eq("published", true)
    .contains("topics", [topicSlug])
    .order("publish_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getArticlesByTopic error:", error);
    return [];
  }
  return (data ?? []) as unknown as ArticleSummary[];
}

/**
 * Aggregate the unique set of AI-generated tag slugs used across all
 * published articles. Powers the /tags index and search.
 */
export async function getAllTags(): Promise<
  Array<{ slug: string; count: number; firstSeen: string }>
> {
  const articles = await getAllArticles();
  const counter = new Map<string, { count: number; firstSeen: string }>();
  for (const a of articles) {
    for (const tag of a.tags ?? []) {
      const prev = counter.get(tag);
      if (prev) {
        prev.count++;
        if (a.publish_date < prev.firstSeen) prev.firstSeen = a.publish_date;
      } else {
        counter.set(tag, { count: 1, firstSeen: a.publish_date });
      }
    }
  }
  return [...counter.entries()]
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.count - a.count);
}

export async function getArticlesByTag(
  tagSlug: string,
  limit = 50,
): Promise<ArticleSummary[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .contains("tags", [tagSlug])
    .order("publish_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getArticlesByTag error:", error);
    return [];
  }
  return ((data ?? []) as Article[]).map(a => ({
    ...a,
    hero_image_url: rewriteHeroUrl(a.hero_image_url),
  }));
}

export async function getArticlesByTheme(
  themeSlug: string,
  limit = 50,
): Promise<ArticleSummary[]> {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SUMMARY_COLS)
    .eq("published", true)
    .contains("themes", [themeSlug])
    .order("publish_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getArticlesByTheme error:", error);
    return [];
  }
  return (data ?? []) as unknown as ArticleSummary[];
}

export async function getAllThemes(): Promise<Theme[]> {
  // Order by name — schema has no display_order column. For canonical
  // ordering, consumers should map Supabase rows onto src/lib/themes.ts
  // canonicalThemes (which carries the authoritative ordering).
  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.error("getAllThemes error:", error);
    return [];
  }
  return (data ?? []) as Theme[];
}

// Listing-page columns for entities — drops `long_form` and
// `long_form_intro`, which only the entity detail page renders.
const ENTITY_LIST_COLUMNS = [
  "id", "type", "slug", "name", "aliases", "description",
  "external_links", "metadata", "themes", "lenses",
  "canonical_url", "schema_jsonld", "created_at", "updated_at",
].join(",");

const _entitiesCache = new Map<Entity["type"], Promise<Entity[]>>();

export async function getAllEntitiesByType(
  type: Entity["type"],
): Promise<Entity[]> {
  const cached = _entitiesCache.get(type);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("entities")
      .select(ENTITY_LIST_COLUMNS)
      .eq("type", type)
      .order("name", { ascending: true });
    if (error) {
      console.error("getAllEntitiesByType error:", error);
      return [];
    }
    return (data ?? []) as unknown as Entity[];
  })();
  _entitiesCache.set(type, promise);
  return promise;
}

export async function getEntityBySlug(
  type: Entity["type"],
  slug: string,
): Promise<Entity | null> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("type", type)
    .eq("slug", slug)
    .single();
  if (error) {
    console.error("getEntityBySlug error:", error);
    return null;
  }
  return data as Entity;
}

// Row shape from article_entities joined with entities — what the sidebar renders.
export interface ArticleEntity {
  entity_slug: string;
  entity_type: Entity["type"];
  entity_name: string;
  relevance: string | null; // 'mention' | 'subject' | 'author' (per schema default 'mention')
}

/**
 * Fetch entities linked to an article via the article_entities join table.
 * The join table uses UUID foreign keys (article_id, entity_id), so we use a
 * Supabase nested-select with the articles!inner filter to look up by slug in
 * a single query.
 *
 * Returns empty array if the article has no linked entities or the table is
 * absent — build must never fail on this.
 */
export async function getArticleEntities(
  articleSlug: string,
): Promise<ArticleEntity[]> {
  const { data, error } = await supabase
    .from("article_entities")
    .select(
      `
      relevance,
      entities!inner ( slug, type, name ),
      articles!inner ( slug )
    `,
    )
    .eq("articles.slug", articleSlug);
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    entity_slug: row.entities.slug,
    entity_type: row.entities.type,
    entity_name: row.entities.name,
    relevance: row.relevance ?? null,
  }));
}

/**
 * Fetch all articles linked to a given entity slug.
 * Used by entity hub pages (/people/[slug], /concepts/[slug], etc.)
 *
 * Uses the same nested-select pattern: filter article_entities by the joined
 * entity's slug, then hydrate the full article rows.
 */
export async function getArticlesByEntity(
  entitySlug: string,
  limit = 20,
): Promise<ArticleSummary[]> {
  // Try join table first
  const { data: rows } = await supabase
    .from("article_entities")
    .select(
      `
      articles!inner (${ARTICLE_SUMMARY_COLS}),
      entities!inner ( slug )
    `,
    )
    .eq("entities.slug", entitySlug)
    .limit(limit);

  const fromJoin = (rows ?? [])
    .map((r: any) => r.articles as ArticleSummary)
    .filter((a) => a && a.published);

  // Also text-search titles/descriptions for the entity name
  const entityName = entitySlug.replace(/-/g, " ");
  const safeName = entityName.replace(/[%,().*\\]/g, "");
  let byTitle: ArticleSummary[] = [];
  if (safeName.length >= 3) {
    const { data } = await supabase
      .from("articles")
      .select(ARTICLE_SUMMARY_COLS)
      .eq("published", true)
      .or(`title.ilike.%${safeName}%,meta_description.ilike.%${safeName}%`)
      .order("publish_date", { ascending: false })
      .limit(limit);
    byTitle = (data ?? []) as unknown as ArticleSummary[];
  }

  // Deduplicate + sort
  const all = [...fromJoin, ...byTitle];
  const seen = new Set<string>();
  const unique = all.filter((a) => {
    if (!a?.slug || seen.has(a.slug)) return false;
    seen.add(a.slug);
    return true;
  });
  unique.sort((a, b) => (a.publish_date < b.publish_date ? 1 : -1));
  return unique.slice(0, limit);
}

// ── Site Settings ─────────────────────────────────────────────────────────────

const _settingsCache = new Map<string, Promise<any>>();

export async function getSiteSetting(key: string): Promise<any> {
  const cached = _settingsCache.get(key);
  if (cached !== undefined) return cached;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .single();
    if (error) {
      console.warn(`[getSiteSetting] key="${key}" error: ${error.code} ${error.message}`);
    } else if (!data) {
      console.warn(`[getSiteSetting] key="${key}" returned no row`);
    }
    return data?.value ?? null;
  })();
  _settingsCache.set(key, promise);
  return promise;
}

// ── YouTube Shorts (via Supabase edge function) ─────────────────────────────

export interface YouTubeShort {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

export interface LatestShortsResult {
  shorts: YouTubeShort[];      // most-recent first
  mostWatched: YouTubeShort | null;
}

/**
 * Fetch the latest Shorts + the most-watched Short for a YouTube channel.
 * Backed by the Supabase edge function `get-latest-short` (deployed on the
 * shared Supabase project) which holds the YOUTUBE_API_KEY server-side.
 *
 * Called at BUILD TIME from /podcast.astro — result is baked into the
 * generated HTML. Content refreshes on every site rebuild (triggered by
 * publish_articles.py or a scheduled CF Pages rebuild).
 *
 * Returns empty results on failure so the build doesn't break.
 */
export async function getLatestShorts(
  channelId: string,
  count = 2,
): Promise<LatestShortsResult> {
  try {
    const { data, error } = await supabase.functions.invoke<LatestShortsResult>(
      "get-latest-short",
      { body: { channelId, count } },
    );
    if (error) {
      console.error("getLatestShorts error:", error.message);
      return { shorts: [], mostWatched: null };
    }
    return {
      shorts: data?.shorts ?? [],
      mostWatched: data?.mostWatched ?? null,
    };
  } catch (err) {
    console.error("getLatestShorts threw:", err);
    return { shorts: [], mostWatched: null };
  }
}

export async function getLatestEpisodes(limit = 2): Promise<Episode[]> {
  const { data, error } = await supabase
    .from("episode_shownotes")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getLatestEpisodes error:", error);
    return [];
  }
  return (data ?? []) as Episode[];
}

export async function getEpisodesByTheme(themeSlug: string, limit = 20): Promise<Episode[]> {
  const { data, error } = await supabase
    .from("episode_shownotes")
    .select("*")
    .eq("published", true)
    .contains("themes", [themeSlug])
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getEpisodesByTheme error:", error);
    return [];
  }
  return (data ?? []) as Episode[];
}

export async function getEntitiesByTheme(themeSlug: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .contains("themes", [themeSlug])
    .order("name", { ascending: true });
  if (error) {
    console.error("getEntitiesByTheme error:", error);
    return [];
  }
  return (data ?? []) as Entity[];
}

// Listing-page columns for episodes — drops `content_html` and the
// (potentially huge) `transcript_markdown`, which only the episode
// detail page consumes.
const EPISODE_LIST_COLUMNS = [
  "episode_guid", "slug", "title", "meta_description",
  "episode_number", "season_number", "duration",
  "themes", "lenses", "hosts", "guests",
  "schema_jsonld", "published_at", "links", "video_urls", "published",
].join(",");

let _episodesCache: Promise<Episode[]> | null = null;

export async function getAllEpisodes(): Promise<Episode[]> {
  if (_episodesCache) return _episodesCache;
  _episodesCache = (async () => {
    const { data, error } = await supabase
      .from("episode_shownotes")
      .select(EPISODE_LIST_COLUMNS)
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (error) {
      console.error("getAllEpisodes error:", error);
      return [];
    }
    return (data ?? []) as unknown as Episode[];
  })();
  return _episodesCache;
}

export async function getEpisodeBySlug(slug: string): Promise<Episode | null> {
  const { data, error } = await supabase
    .from("episode_shownotes")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (error) {
    console.error("getEpisodeBySlug error:", error);
    return null;
  }
  return data as Episode;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function authorDisplayName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatLabel(format: ArticleFormat): string {
  const labels: Record<ArticleFormat, string> = {
    "news-brief": "News Brief",
    "news-analysis": "News Analysis",
    "release-note": "New Releases",
    feature: "Feature",
    "data-reports": "Data & Reports",
    "case-study": "Case Study",
    opinion: "Opinion",
    explainer: "Explainer",
    "product-review": "Product Review",
    "research-brief": "Research Brief",
    "playbook": "Playbook",
  };
  return labels[format] ?? format;
}

export function themeLabel(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Strip the first <h1> from content_html to avoid duplicate title rendering.
 * The article page template renders its own H1 from article.title, so we
 * remove any leading H1 in the body to prevent the "title rendered twice" bug
 * that showed up in Lovable's implementation.
 */
export function stripFirstH1(html: string): string {
  return html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

/**
 * Generate overview bullets from article body HTML if the stored bullets
 * field is empty. Extracts the first sentence of each H2 section (or the
 * first three sentences of the intro paragraph as a fallback).
 */
export function generateOverviewBullets(html: string, max = 5): string[] {
  const stripped = stripFirstH1(html);
  // Match H2 sections and grab the first paragraph after each one
  const sections = [
    ...stripped.matchAll(
      /<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/gi,
    ),
  ];
  if (sections.length > 0) {
    return sections
      .slice(0, max)
      .map((m) => {
        const firstSentence = m[1]
          .replace(/<[^>]+>/g, "")
          .split(/\.\s/)[0]
          .trim();
        return firstSentence.endsWith(".")
          ? firstSentence
          : firstSentence + ".";
      })
      .filter((s) => s.length > 20);
  }
  // Fallback: first paragraph split into sentences
  const firstP = stripped.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!firstP) return [];
  const text = firstP[1].replace(/<[^>]+>/g, "");
  return text
    .split(/\.\s/)
    .slice(0, 3)
    .map((s) => (s.endsWith(".") ? s.trim() : s.trim() + "."))
    .filter((s) => s.length > 20);
}

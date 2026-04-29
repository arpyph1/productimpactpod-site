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
  | "research-brief";

export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  format: ArticleFormat;
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
  // Entity slug arrays — populated by join in publish_articles.py
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

export async function getAllArticles(): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .order("publish_date", { ascending: false });
  if (error) {
    console.error("getAllArticles error:", error);
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
): Promise<Article[]> {
  if (!article.themes || article.themes.length === 0) {
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("published", true)
      .neq("slug", article.slug)
      .order("publish_date", { ascending: false })
      .limit(limit);
    return (data ?? []) as Article[];
  }
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .neq("slug", article.slug)
    .overlaps("themes", article.themes)
    .order("publish_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getRelatedArticles error:", error);
    return [];
  }
  return (data ?? []) as Article[];
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
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .contains("topics", [topicSlug])
    .order("publish_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getArticlesByTopic error:", error);
    return [];
  }
  return (data ?? []) as Article[];
}

export async function getArticlesByTheme(
  themeSlug: string,
  limit = 50,
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .contains("themes", [themeSlug])
    .order("publish_date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getArticlesByTheme error:", error);
    return [];
  }
  return (data ?? []) as Article[];
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

export async function getAllEntitiesByType(
  type: Entity["type"],
): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("type", type)
    .order("name", { ascending: true });
  if (error) {
    console.error("getAllEntitiesByType error:", error);
    return [];
  }
  return (data ?? []) as Entity[];
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
): Promise<Article[]> {
  // Try join table first
  const { data: rows } = await supabase
    .from("article_entities")
    .select(
      `
      articles!inner (*),
      entities!inner ( slug )
    `,
    )
    .eq("entities.slug", entitySlug)
    .limit(limit);

  const fromJoin = (rows ?? [])
    .map((r: any) => r.articles as Article)
    .filter((a) => a && a.published);

  // Also search articles that mention this entity in their arrays
  const entityName = entitySlug.replace(/-/g, " ");
  // Escape PostgREST special characters to prevent filter injection
  const safeSlug = entitySlug.replace(/[%,().*\\]/g, "");
  const safeName = entityName.replace(/[%,().*\\]/g, "");
  const { data: byArray } = await supabase
    .from("articles")
    .select("*")
    .eq("published", true)
    .or(`organizations.cs.{${safeSlug}},organizations.cs.{${safeName}},people.cs.{${safeSlug}},people.cs.{${safeName}},products.cs.{${safeSlug}},products.cs.{${safeName}}`)
    .order("publish_date", { ascending: false })
    .limit(limit);

  // Also text search titles
  const titleSearch = safeName.length >= 3 ? safeSlug : null;
  let byTitle: Article[] = [];
  if (titleSearch) {
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("published", true)
      .or(`title.ilike.%${safeName}%,meta_description.ilike.%${safeName}%`)
      .order("publish_date", { ascending: false })
      .limit(limit);
    byTitle = (data ?? []) as Article[];
  }

  // Deduplicate + sort
  const all = [...fromJoin, ...((byArray ?? []) as Article[]), ...byTitle];
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

export async function getSiteSetting(key: string): Promise<any> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
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

export async function getAllEpisodes(): Promise<Episode[]> {
  const { data, error } = await supabase
    .from("episode_shownotes")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) {
    console.error("getAllEpisodes error:", error);
    return [];
  }
  return (data ?? []) as Episode[];
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
    "release-note": "Release",
    feature: "Feature",
    "data-reports": "Data & Reports",
    "case-study": "Case Study",
    opinion: "Opinion",
    explainer: "Explainer",
    "product-review": "Product Review",
    "research-brief": "Research Brief",
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

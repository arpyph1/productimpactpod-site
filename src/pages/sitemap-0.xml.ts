// /sitemap-0.xml — comprehensive URL list for crawlers.
// Replaces the @astrojs/sitemap plugin output so we can exclude
// noindex routes (entity indexes, paginated views) and thin entity
// detail pages that would otherwise show up as
// "Discovered/Crawled — currently not indexed" in Search Console.
//
// /sitemap.xml is the index that points here + at /news-sitemap.xml.

import type { APIRoute } from "astro";
import {
  getAllArticles,
  getAllTopics,
  getAllTags,
  getAllEntitiesByType,
  type Entity,
} from "@lib/supabase";

const SITE = "https://productimpactpod.com";

const STATIC_PATHS: Array<{ path: string; priority?: number; changefreq?: string }> = [
  { path: "/",              priority: 1.0, changefreq: "daily" },
  { path: "/news/",         priority: 0.9, changefreq: "hourly" },
  { path: "/podcast/",      priority: 0.9, changefreq: "weekly" },
  { path: "/episodes/",     priority: 0.8, changefreq: "weekly" },
  { path: "/themes/",       priority: 0.7, changefreq: "weekly" },
  { path: "/topics/",       priority: 0.6, changefreq: "weekly" },
  { path: "/tags/",         priority: 0.6, changefreq: "weekly" },
  { path: "/companies/",    priority: 0.6, changefreq: "weekly" },
  { path: "/about/",        priority: 0.5, changefreq: "monthly" },
  { path: "/contact/",      priority: 0.5, changefreq: "monthly" },
  { path: "/partnerships/", priority: 0.5, changefreq: "monthly" },
  { path: "/privacy/",      priority: 0.3, changefreq: "yearly" },
  { path: "/terms/",        priority: 0.3, changefreq: "yearly" },
  { path: "/news/archive/", priority: 0.5, changefreq: "weekly" },
];

// One entry per canonical theme slug. Hardcoded mirror of THEMES
// in admin/ArticleModal.tsx so the sitemap doesn't depend on a
// Supabase round-trip for an enum.
const THEME_SLUGS = [
  "ai-product-strategy",
  "adoption-organizational-change",
  "agents-agentic-systems",
  "data-semantics-knowledge-foundations",
  "evaluation-benchmarking",
  "go-to-market-distribution",
  "governance-risk-trust",
  "ux-experience-design-for-ai",
];

const ENTITY_TYPE_PATHS: Record<Entity["type"], string> = {
  person: "people",
  organization: "organizations",
  product: "products",
  concept: "concepts",
  framework: "frameworks",
  source: "sources",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(path: string, lastmod?: string, priority?: number, changefreq?: string): string {
  const loc = `${SITE}${path}`;
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined) parts.push(`    <priority>${priority.toFixed(1)}</priority>`);
  return `  <url>\n${parts.join("\n")}\n  </url>`;
}

export const GET: APIRoute = async () => {
  const today = new Date().toISOString().slice(0, 10);

  // Articles — everything published gets indexed.
  const articles = await getAllArticles();

  // Compute entity reference counts from the article join arrays so we can
  // suppress thin entity pages (no long-form description AND barely
  // mentioned across the archive). Concepts/frameworks/sources aren't in
  // those arrays — for those we just gate on long_form presence.
  const entityRefs = new Map<string, number>(); // slug → count
  for (const a of articles) {
    for (const slug of a.people ?? [])         entityRefs.set(slug, (entityRefs.get(slug) ?? 0) + 1);
    for (const slug of a.organizations ?? [])  entityRefs.set(slug, (entityRefs.get(slug) ?? 0) + 1);
    for (const slug of a.products ?? [])       entityRefs.set(slug, (entityRefs.get(slug) ?? 0) + 1);
  }

  function isWorthIndexing(entity: Entity): boolean {
    if (entity.long_form && entity.long_form.trim().length > 200) return true;
    const refs = entityRefs.get(entity.slug) ?? 0;
    if (entity.type === "person" || entity.type === "organization" || entity.type === "product") {
      return refs >= 3;
    }
    // concept/framework/source — only include when there's a real description.
    return false;
  }

  const [people, organizations, products, concepts, frameworks, sources] = await Promise.all([
    getAllEntitiesByType("person"),
    getAllEntitiesByType("organization"),
    getAllEntitiesByType("product"),
    getAllEntitiesByType("concept"),
    getAllEntitiesByType("framework"),
    getAllEntitiesByType("source"),
  ]);
  const allEntities = [...people, ...organizations, ...products, ...concepts, ...frameworks, ...sources];
  const indexableEntities = allEntities.filter(isWorthIndexing);

  // Topics + tags — drop singletons. One-article hubs are crawled-not-indexed
  // territory and dilute the sitemap; readers can still reach them via the
  // index pages.
  const topics = (await getAllTopics()).filter(t => t.count >= 2);
  const tags   = (await getAllTags()).filter(t => t.count >= 2);

  const entries: string[] = [];

  for (const s of STATIC_PATHS) {
    entries.push(urlEntry(s.path, today, s.priority, s.changefreq));
  }

  // Themes — eight canonical slugs, all hand-curated.
  for (const slug of THEME_SLUGS) {
    entries.push(urlEntry(`/themes/${slug}/`, today, 0.7, "weekly"));
  }

  // Articles
  for (const a of articles) {
    const lastmod = (a.last_updated ?? a.publish_date ?? today).slice(0, 10);
    entries.push(urlEntry(`/news/${a.slug}/`, lastmod, 0.8, "weekly"));
  }

  // Entities — only the ones above the thin-page threshold.
  for (const e of indexableEntities) {
    entries.push(urlEntry(`/${ENTITY_TYPE_PATHS[e.type]}/${e.slug}/`, today, 0.5, "monthly"));
  }

  // Topics + tags hubs (multi-article only).
  for (const t of topics) entries.push(urlEntry(`/topics/${t.slug}/`, today, 0.4, "monthly"));
  for (const t of tags)   entries.push(urlEntry(`/tags/${t.slug}/`,   today, 0.4, "monthly"));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

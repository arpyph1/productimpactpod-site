// Google News sitemap — 48-hour rolling window.
// Google News only indexes articles published within the last 2 days.
// This endpoint is called at build time (static output) — Cloudflare Pages
// rebuilds trigger on every content publish so the window stays fresh.
// Spec: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap

import type { APIRoute } from "astro";
import { getAllArticles } from "@lib/supabase";

const SITE_URL = "https://productimpactpod.com";
const PUBLICATION_NAME = "Product Impact";
const PUBLICATION_LANGUAGE = "en";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = async () => {
  const allArticles = await getAllArticles();

  // Google News sitemap: only articles from the last 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(
    (a) => new Date(a.publish_date) >= cutoff,
  );

  const items = recentArticles
    .map((article) => {
      const canonicalUrl =
        article.canonical_url?.startsWith(SITE_URL)
          ? article.canonical_url
          : `${SITE_URL}/news/${article.slug}`;

      const pubDate = new Date(article.publish_date).toISOString();

      // Keywords: themes + topics, comma-separated, max ~10 terms per Google spec
      const keywords = [
        ...(article.themes ?? []),
        ...(article.topics ?? []),
      ]
        .slice(0, 10)
        .map((k) =>
          k
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        )
        .join(", ");

      return `  <url>
    <loc>${escapeXml(canonicalUrl)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>${PUBLICATION_LANGUAGE}</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
      ${keywords ? `<news:keywords>${escapeXml(keywords)}</news:keywords>` : ""}
    </news:news>
    ${article.hero_image_url ? `<image:image>
      <image:loc>${escapeXml(article.hero_image_url)}</image:loc>
      <image:title>${escapeXml(article.title)}</image:title>
    </image:image>` : ""}
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${items}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Cache for 30 minutes — CF Pages will serve this from edge
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
};

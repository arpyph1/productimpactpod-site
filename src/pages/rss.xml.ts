// Main RSS feed — excerpt-only (not full content). For full content, use /news/rss.xml.
// Includes dc:creator and atom:link for standards compliance.

import { getAllArticles, authorDisplayName } from "@lib/supabase";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  const articles = await getAllArticles();
  const siteUrl = "https://productimpactpod.com";
  const now = new Date().toUTCString();

  const items = articles
    .slice(0, 50)
    .map((a) => {
      const link = `${siteUrl}/news/${a.slug}/`;
      const pubDate = new Date(a.publish_date).toUTCString();
      const author = authorDisplayName(a.author_slugs?.[0] ?? "arpy-dragffy");
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${esc(author)}</dc:creator>
      <description>${esc(a.meta_description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Product Impact</title>
    <link>${siteUrl}</link>
    <description>AI product impact — news, releases, and case studies.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}

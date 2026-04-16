// News RSS feed — full content, optimized for Google News, Apple News, Flipboard.
// Includes <media:content> for hero images and <dc:creator> for author attribution.

import { getAllArticles, authorDisplayName } from "@lib/supabase";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  const articles = await getAllArticles();
  const siteUrl = "https://productimpactpod.com";
  const now = new Date().toUTCString();

  const items = articles
    .map((a) => {
      const link = `${siteUrl}/news/${a.slug}/`;
      const pubDate = new Date(a.publish_date).toUTCString();
      const author = authorDisplayName(a.author_slugs?.[0] ?? "arpy-dragffy");
      const categories = [...(a.themes ?? []), ...(a.topics ?? [])]
        .map((c) => `      <category>${esc(c)}</category>`)
        .join("\n");
      const mediaTag = a.hero_image_url
        ? `      <media:content url="${esc(a.hero_image_url)}" medium="image" />\n      <media:thumbnail url="${esc(a.hero_image_url)}" />`
        : "";
      const enclosureTag = a.hero_image_url
        ? `      <enclosure url="${esc(a.hero_image_url)}" type="image/jpeg" length="0" />`
        : "";

      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${esc(author)}</dc:creator>
      <description>${esc(a.meta_description)}</description>
      <content:encoded><![CDATA[${a.content_html}]]></content:encoded>
${categories}
${mediaTag}
${enclosureTag}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Product Impact — News</title>
    <link>${siteUrl}/news</link>
    <description>AI product impact — news, releases, and case studies about the products transforming how we work and industries.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteUrl}/news/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${siteUrl}/logo.png</url>
      <title>Product Impact</title>
      <link>${siteUrl}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

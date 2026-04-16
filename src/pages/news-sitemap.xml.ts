import { getAllArticles } from "@lib/supabase";

export async function GET() {
  const articles = await getAllArticles();

  // Google News sitemap: 48-hour rolling window ideally, but since we're
  // static-generated, include all recent articles. Google will ignore
  // articles older than 48 hours from the news sitemap automatically.
  const items = articles
    .filter((a) => {
      const age = Date.now() - new Date(a.publish_date).getTime();
      return age < 30 * 24 * 60 * 60 * 1000; // include last 30 days for safety
    })
    .map((a) => {
      const pubDate = new Date(a.publish_date).toISOString();
      const title = a.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const keywords = [...(a.themes ?? []), ...(a.topics ?? [])]
        .map((k) => k.replace(/-/g, " "))
        .join(", ")
        .replace(/&/g, "&amp;");
      return `  <url>
    <loc>https://productimpactpod.com/news/${a.slug}/</loc>
    <news:news>
      <news:publication>
        <news:name>Product Impact</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>${keywords ? `\n      <news:keywords>${keywords}</news:keywords>` : ""}
    </news:news>
    <lastmod>${pubDate}</lastmod>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

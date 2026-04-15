// /sitemap.xml — master sitemap index.
// Wraps the plugin-generated /sitemap-0.xml (all URLs) and our
// /news-sitemap.xml (48-hour rolling Google News feed) under a single
// index that Search Console and Bing can both ingest.
//
// robots.txt advertises /sitemap.xml — this endpoint is what they hit.

import type { APIRoute } from "astro";

const SITE = "https://productimpactpod.com";

export const GET: APIRoute = () => {
  const lastmod = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE}/sitemap-0.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE}/news-sitemap.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};

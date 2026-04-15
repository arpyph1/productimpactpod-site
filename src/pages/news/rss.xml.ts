// News-specific RSS feed with full article content in <content:encoded>.
// Some aggregators (Techmeme, Feedly) require full content to display article previews.

import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getAllArticles } from "@lib/supabase";

export const GET: APIRoute = async () => {
  const articles = await getAllArticles();
  const siteUrl = "https://productimpactpod.com";

  return rss({
    title: "Product Impact — News",
    description:
      "AI product impact — news, releases, and case studies about the products transforming how we work and industries.",
    site: siteUrl,
    items: articles.slice(0, 50).map((article) => {
      const canonicalUrl =
        article.canonical_url?.startsWith(siteUrl)
          ? article.canonical_url
          : `${siteUrl}/news/${article.slug}`;

      return {
        title: article.title,
        description: article.meta_description,
        pubDate: new Date(article.publish_date),
        link: `/news/${article.slug}`,
        categories: [...(article.themes ?? []), ...(article.topics ?? [])],
        // Full content for aggregators that support it
        content: article.content_html,
        author: (article.author_slugs ?? [])
          .map((s) =>
            s
              .replace(/-/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
          )
          .join(", "),
        customData: [
          article.hero_image_url
            ? `<media:content url="${article.hero_image_url}" medium="image" />`
            : "",
          `<guid isPermaLink="true">${canonicalUrl}</guid>`,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }),
    xmlns: {
      media: "http://search.yahoo.com/mrss/",
      content: "http://purl.org/rss/1.0/modules/content/",
    },
    customData: [
      `<language>en-us</language>`,
      `<managingEditor>info@productimpactpod.com (Product Impact)</managingEditor>`,
      `<webMaster>info@productimpactpod.com (Product Impact)</webMaster>`,
      `<copyright>© ${new Date().getFullYear()} Product Impact Podcast. All rights reserved.</copyright>`,
      `<ttl>60</ttl>`,
      `<atom:link href="${siteUrl}/news/rss.xml" rel="self" type="application/rss+xml" />`,
    ].join("\n"),
  });
};

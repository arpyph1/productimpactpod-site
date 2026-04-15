// Main RSS feed — all published articles, newest first.
// Astro's @astrojs/rss handles the XML boilerplate and encodes content correctly.

import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getAllArticles } from "@lib/supabase";

export const GET: APIRoute = async () => {
  const articles = await getAllArticles();

  return rss({
    title: "Product Impact — News & Analysis",
    description:
      "AI product impact — news, releases, and case studies about the products transforming how we work and industries.",
    site: "https://productimpactpod.com",
    items: articles.slice(0, 50).map((article) => ({
      title: article.title,
      description: article.meta_description,
      pubDate: new Date(article.publish_date),
      link: `/news/${article.slug}`,
      categories: [...(article.themes ?? []), ...(article.topics ?? [])],
      content: article.content_html,
      author: (article.author_slugs ?? [])
        .map((s) =>
          s
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        )
        .join(", "),
    })),
    customData: [
      `<language>en-us</language>`,
      `<managingEditor>info@productimpactpod.com (Product Impact)</managingEditor>`,
      `<webMaster>info@productimpactpod.com (Product Impact)</webMaster>`,
      `<copyright>© ${new Date().getFullYear()} Product Impact Podcast. All rights reserved.</copyright>`,
      `<ttl>60</ttl>`,
    ].join("\n"),
  });
};

// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://productimpactpod.com",
  output: "static",
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      // Keep the sitemap aligned with what we actually want indexed —
      // noindexed routes (admin, error pages, paginated/filter views)
      // shouldn't be advertised to crawlers.
      filter: (page) =>
        !page.includes("/admin") &&
        !page.includes("/404") &&
        !page.includes("/500") &&
        !page.includes("/news/format/") &&
        !page.includes("/news/page/"),
      changefreq: "daily",
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  build: {
    format: "directory",
    inlineStylesheets: "auto",
  },
  compressHTML: true,
  vite: {
    ssr: {
      noExternal: ["@supabase/supabase-js"],
    },
  },
});

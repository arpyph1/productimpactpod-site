// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// Sitemap is hand-rolled at /sitemap-0.xml.ts so it can suppress
// thin entity pages, noindexed format/pagination URLs, and other
// low-value paths the @astrojs/sitemap plugin would auto-include.
//
// https://astro.build/config
export default defineConfig({
  site: "https://productimpactpod.com",
  output: "static",
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
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

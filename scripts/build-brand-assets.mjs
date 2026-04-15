#!/usr/bin/env node
/**
 * Rasterise SVG brand sources in src/brand/ to PNGs in public/.
 *
 * Runs as `prebuild` via npm — so `npm run build` always produces fresh
 * PNGs matching the SVG sources. Also runnable on demand:
 *   npm run build:assets
 *
 * The rasterised PNGs are intentionally committed to git. This keeps
 * Cloudflare Pages builds fast (no font loading at deploy time) and
 * lets us review visual changes in pull requests. The script is
 * idempotent — running it repeatedly produces byte-identical output.
 */

import { Resvg } from "@resvg/resvg-js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const brandDir = resolve(root, "src/brand");
const publicDir = resolve(root, "public");

/**
 * @type {{ src: string; out: string; width: number; height?: number; fitTo?: "width" | "height" }[]}
 */
const targets = [
  // Favicon — 32×32 (legacy browsers) and 16×16 (very legacy)
  { src: "mark.svg", out: "favicon.png",           width: 32 },
  { src: "mark.svg", out: "favicon-16.png",        width: 16 },
  { src: "mark.svg", out: "favicon-96.png",        width: 96 },
  { src: "mark.svg", out: "favicon-192.png",       width: 192 },
  { src: "mark.svg", out: "favicon-512.png",       width: 512 },

  // iOS home screen icon — Apple recommends 180×180
  { src: "mark.svg", out: "apple-touch-icon.png",  width: 180 },

  // Publisher logo — Google News wants ≥60px height, ≤600px wide, aspect 10:1 max
  { src: "logo-wordmark.svg", out: "logo.png",     width: 600, height: 60 },

  // Larger publisher logo for Rich Results testing
  { src: "logo-wordmark.svg", out: "logo-large.png", width: 1200, height: 120 },

  // Open Graph default — 1200×628 (Twitter/LinkedIn/Facebook standard)
  { src: "og-default.svg", out: "og-default.png", width: 1200, height: 628 },
];

async function rasterise(srcPath, outPath, width, height) {
  const svg = await readFile(srcPath, "utf8");

  const opts = {
    fitTo:
      height === undefined
        ? { mode: "width", value: width }
        : { mode: "zoom", value: 1 }, // use viewBox directly, then resize
    font: {
      loadSystemFonts: true,
      // Fall back sans-serifs if nothing system-specific is installed.
      // CF Pages build environment (Ubuntu) has Liberation Sans by default.
      defaultFontFamily: "Liberation Sans",
    },
    background: "transparent",
  };

  // For fixed-aspect outputs (logo, OG image), use the SVG's natural viewBox
  // and resize post-render. Avoids letterboxing.
  if (height !== undefined) {
    opts.fitTo = { mode: "width", value: width };
  }

  const resvg = new Resvg(svg, opts);
  const pngData = resvg.render().asPng();

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, pngData);

  return pngData.byteLength;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  console.log("Building brand assets…");
  let total = 0;
  for (const { src, out, width, height } of targets) {
    const srcPath = resolve(brandDir, src);
    const outPath = resolve(publicDir, out);
    const bytes = await rasterise(srcPath, outPath, width, height);
    total += bytes;
    console.log(`  ✓ ${out.padEnd(24)} ${(bytes / 1024).toFixed(1).padStart(6)} KB  (${width}${height ? `×${height}` : ""})`);
  }
  console.log(`Done. ${targets.length} assets, ${(total / 1024).toFixed(1)} KB total.`);
}

main().catch((err) => {
  console.error("Brand asset build failed:", err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Brand asset pipeline.
 *
 * Sources (in src/brand/):
 *   PIP favicon.png         — hand-crafted 16×16 favicon
 *   PIP circle logo 100.png — circle-only mark, 100×100
 *   PIP logo 500.png        — full logo (circle + wordmark), 500×500
 *   PIP logo 1000.png       — full logo, 1000×1000 (highest-res source)
 *
 * Outputs (in public/) — rules of thumb:
 *   - Below 96px: circle-only (text becomes unreadable)
 *   - 180px and up: full logo (text is legible)
 *   - Publisher logo (horizontal): mark on left + composed wordmark text
 *   - OG card: full logo centered on dark background + tagline/domain
 *
 * Runs as `npm run build:assets` or automatically via `prebuild` before
 * every `npm run build`. Generated PNGs are committed to the repo.
 */

import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const brandDir = resolve(root, "src/brand");
const publicDir = resolve(root, "public");

// Source file paths
const SRC_FAVICON_16 = resolve(brandDir, "PIP favicon.png");
const SRC_CIRCLE_100 = resolve(brandDir, "PIP circle logo 100.png");
const SRC_FULL_500   = resolve(brandDir, "PIP logo 500.png");
const SRC_FULL_1000  = resolve(brandDir, "PIP logo 1000.png");

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function copyExact(src, outName) {
  const buf = await readFile(src);
  const outPath = resolve(publicDir, outName);
  await writeFile(outPath, buf);
  return { name: outName, bytes: buf.byteLength, width: null, height: null };
}

async function resizeSquare(src, outName, size) {
  const outPath = resolve(publicDir, outName);
  const buf = await sharp(src)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // transparent letterbox
      kernel: "lanczos3",
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(outPath, buf);
  return { name: outName, bytes: buf.byteLength, width: size, height: size };
}

/**
 * Compose the horizontal publisher logo: circle mark on the left, wordmark
 * text on the right. Google News requires this shape (≤ 600×60 recommended,
 * aspect ratio close to 10:1). We render larger and smaller variants.
 */
async function composePublisherLogo(outName, width, height) {
  const outPath = resolve(publicDir, outName);

  // Mark fits the full height with a small margin
  const markSize = height - 8;
  const markTop = Math.round((height - markSize) / 2);
  const markLeft = 4;

  const markBuffer = await sharp(SRC_FULL_1000)
    .resize(markSize, markSize, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  // Wordmark text rendered via SVG → Sharp's font rendering uses
  // whatever fontconfig resolves sans-serif to (Liberation Sans in CF Pages).
  const textLeft = markLeft + markSize + Math.round(height * 0.28);
  const fontSize = Math.round(height * 0.52);
  const baselineY = Math.round(height * 0.68);

  const textSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width - textLeft}" height="${height}">
      <text x="0" y="${baselineY}"
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
            font-size="${fontSize}"
            font-weight="800"
            fill="#ffffff"
            letter-spacing="-1">Product Impact</text>
    </svg>
  `);

  const buf = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 1 }, // #0a0a0a
    },
  })
    .composite([
      { input: markBuffer, top: markTop, left: markLeft },
      { input: textSvg, top: 0, left: textLeft },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(outPath, buf);
  return { name: outName, bytes: buf.byteLength, width, height };
}

/**
 * OG social-share card. 1200×628 dark background, full logo centered with
 * tagline and domain below. Used by any page that doesn't set ogImage.
 */
async function composeOgCard(outName) {
  const outPath = resolve(publicDir, outName);
  const width = 1200;
  const height = 628;

  // Full logo at 340×340, centered horizontally, positioned in upper half
  const logoSize = 340;
  const logoLeft = Math.round((width - logoSize) / 2);
  const logoTop = 60;

  const logoBuffer = await sharp(SRC_FULL_1000)
    .resize(logoSize, logoSize, { kernel: "lanczos3" })
    .png()
    .toBuffer();

  // Text + top accent bar rendered as SVG overlay so fontconfig handles text
  const overlaySvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="topBar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stop-color="#ff6b4a"/>
          <stop offset="100%" stop-color="#ff8566"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="10" fill="url(#topBar)"/>
      <text x="${width / 2}" y="468"
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
            font-size="32"
            font-weight="500"
            fill="#d4d4d4"
            text-anchor="middle">AI product news, releases, and case studies</text>
      <text x="${width / 2}" y="578"
            font-family="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
            font-size="22"
            font-weight="600"
            fill="#ff6b4a"
            text-anchor="middle"
            letter-spacing="0.5">productimpactpod.com</text>
    </svg>
  `);

  const buf = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 1 },
    },
  })
    .composite([
      { input: logoBuffer, top: logoTop, left: logoLeft },
      { input: overlaySvg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(outPath, buf);
  return { name: outName, bytes: buf.byteLength, width, height };
}

/* ── Target list ────────────────────────────────────────────────────────── */

async function buildAll() {
  await mkdir(publicDir, { recursive: true });

  const results = [];

  // Favicon: 16×16 (hand-crafted, use verbatim)
  results.push(await copyExact(SRC_FAVICON_16, "favicon-16.png"));

  // Favicon variants — circle-only for 32/96, full logo for 192/512
  results.push(await resizeSquare(SRC_CIRCLE_100, "favicon.png",     32));
  results.push(await resizeSquare(SRC_CIRCLE_100, "favicon-96.png",  96));
  results.push(await resizeSquare(SRC_FULL_500,   "favicon-192.png", 192));
  results.push(await resizeSquare(SRC_FULL_1000,  "favicon-512.png", 512));

  // iOS home screen icon — full logo so the wordmark is visible
  results.push(await resizeSquare(SRC_FULL_500, "apple-touch-icon.png", 180));

  // Horizontal publisher logos — circle + "Product Impact" wordmark
  results.push(await composePublisherLogo("logo.png",       600,  60));
  results.push(await composePublisherLogo("logo-large.png", 1200, 120));

  // Open Graph default card
  results.push(await composeOgCard("og-default.png"));

  return results;
}

function fmt(b) { return `${(b / 1024).toFixed(1)} KB`; }

async function main() {
  console.log("Building brand assets from src/brand/ PNG sources…");
  const results = await buildAll();
  let total = 0;
  for (const r of results) {
    const dims = r.width ? `${r.width}${r.height ? `×${r.height}` : ""}` : "copy";
    console.log(`  ✓ ${r.name.padEnd(22)} ${fmt(r.bytes).padStart(8)}  (${dims})`);
    total += r.bytes;
  }
  console.log(`Done. ${results.length} assets, ${fmt(total)} total.`);
}

main().catch((err) => {
  console.error("Brand asset build failed:", err);
  process.exit(1);
});

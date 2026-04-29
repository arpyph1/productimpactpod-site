#!/usr/bin/env node
/**
 * Downloads hero images from Supabase Storage into public/hero-images/
 * so they ship with the Cloudflare Pages deployment (zero Supabase egress).
 * Runs as part of the prebuild step.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.log("⚠ Supabase env vars not set — skipping hero image download");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const OUT_DIR = path.resolve("public/hero-images");
const MAP_FILE = path.resolve("src/data/hero-image-map.json");

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "AstroBuild/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on("finish", () => { stream.close(); resolve(); });
      stream.on("error", reject);
    }).on("error", reject);
  });
}

async function main() {
  const { data: articles, error } = await supabase
    .from("articles")
    .select("slug, hero_image_url")
    .eq("published", true)
    .not("hero_image_url", "is", null);

  if (error) {
    console.error("Failed to fetch articles:", error.message);
    process.exit(0);
  }

  const toDownload = (articles || []).filter(a =>
    a.hero_image_url &&
    a.hero_image_url.startsWith("http") &&
    a.hero_image_url.includes("supabase.co/storage")
  );

  if (toDownload.length === 0) {
    console.log("✓ No Supabase Storage hero images to download");
    process.exit(0);
  }

  console.log(`Downloading ${toDownload.length} hero images...`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const dataDir = path.dirname(MAP_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const urlMap = {};
  let downloaded = 0;
  let skipped = 0;

  for (const article of toDownload) {
    const url = article.hero_image_url;
    const ext = path.extname(new URL(url).pathname) || ".png";
    const filename = `${article.slug}${ext}`;
    const dest = path.join(OUT_DIR, filename);
    const localPath = `/hero-images/${filename}`;

    if (fs.existsSync(dest)) {
      urlMap[url] = localPath;
      skipped++;
      continue;
    }

    try {
      await downloadFile(url, dest);
      urlMap[url] = localPath;
      downloaded++;
    } catch (e) {
      console.warn(`  ✗ Failed: ${article.slug} — ${e.message}`);
    }
  }

  fs.writeFileSync(MAP_FILE, JSON.stringify(urlMap, null, 2));
  console.log(`✓ Downloaded ${downloaded}, skipped ${skipped} (already cached), ${Object.keys(urlMap).length} total mapped`);
}

main();

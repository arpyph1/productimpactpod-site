// Podcast RSS feed parser — fetched at build time for the Episodes
// component. Same pattern as substack.ts: Lovable did this in the
// browser; we do it server-side at build time.
//
// Supports the iTunes Podcasting RSS extensions (itunes:image,
// itunes:duration, itunes:episode) which most podcast hosts emit.

export interface PodcastEpisode {
  guid: string;
  title: string;
  description: string;
  fullDescription: string;
  fullDescriptionHtml: string;
  pubDate: string;
  pubDateISO: string;
  audioUrl: string;
  imageUrl: string;
  duration: string;
  episodeNumber: string;
  link: string;
}

import { STRIP_HTML, UNSAFE_TAGS, decodeHtmlEntities, extractTag, extractAttribute } from "./xml-utils";

interface FetchResult {
  episodes: PodcastEpisode[];
  channelTitle: string;
  channelImage: string;
}

/**
 * Fetch a podcast RSS feed at build time. Returns up to `limit` episodes
 * (most recent first per RSS convention) plus channel-level metadata.
 *
 * Returns empty results on failure so the build never crashes — the
 * Episodes component renders a graceful placeholder.
 */
export async function getPodcastEpisodes(
  feedUrl: string,
  limit = 8,
): Promise<FetchResult> {
  if (!feedUrl) {
    return { episodes: [], channelTitle: "", channelImage: "" };
  }

  let xml: string;
  try {
    const res = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (productimpactpod build)",
        Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`Podcast feed fetch ${feedUrl} → ${res.status}`);
      return { episodes: [], channelTitle: "", channelImage: "" };
    }
    xml = await res.text();
  } catch (err) {
    console.warn(`Podcast feed fetch failed (${feedUrl}):`, err);
    return { episodes: [], channelTitle: "", channelImage: "" };
  }

  // Channel-level metadata (used as fallbacks for episode imageUrl)
  const channelMatch = xml.match(/<channel>([\s\S]*?)<item>/);
  const channelBlock = channelMatch ? channelMatch[1] : xml;
  const channelTitle = decodeHtmlEntities(extractTag(channelBlock, "title"));
  const channelImage =
    extractTag(channelBlock, "url") ||
    extractAttribute(channelBlock, "itunes:image", "href") ||
    "";

  // Extract <item>…</item> blocks
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const episodes: PodcastEpisode[] = [];

  itemBlocks.slice(0, limit).forEach((block, idx) => {
    const title = decodeHtmlEntities(extractTag(block, "title")) ||
      `Episode ${itemBlocks.length - idx}`;

    const guid = extractTag(block, "guid") || `ep-${idx}`;

    // <link> may be a self-closing or text-content tag
    let link = extractTag(block, "link");
    if (!link) {
      const alt = block.match(/<link[^>]*\/?>([^<]+)/);
      if (alt) link = alt[1].trim();
    }

    const pubRaw = extractTag(block, "pubDate");
    let pubDate = "";
    let pubDateISO = "";
    if (pubRaw) {
      const d = new Date(pubRaw);
      if (!isNaN(d.getTime())) {
        pubDate = d.toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });
        pubDateISO = d.toISOString();
      }
    }

    const audioUrl = extractAttribute(block, "enclosure", "url");

    // Episode artwork: itunes:image > media:content > channel image
    const itunesImage = extractAttribute(block, "itunes:image", "href");
    const mediaContent = extractAttribute(block, "media:content", "url");
    const mediaThumb = extractAttribute(block, "media:thumbnail", "url");
    const imageUrl = itunesImage || mediaContent || mediaThumb || channelImage;

    const duration = extractTag(block, "itunes:duration");
    const episodeNumber =
      extractTag(block, "itunes:episode") ||
      String(itemBlocks.length - idx);

    // Description: prefer content:encoded, fall back to itunes:summary, then description
    const contentEncoded = extractTag(block, "content:encoded");
    const itunesSummary = extractTag(block, "itunes:summary");
    const rawDesc = contentEncoded || itunesSummary || extractTag(block, "description");
    const cleanedDesc = decodeHtmlEntities(rawDesc.replace(STRIP_HTML, ""))
      .replace(/\s+/g, " ")
      .trim();
    const description = cleanedDesc.slice(0, 250);
    const fullDescription = cleanedDesc;

    // HTML version: keep formatting (p, br, a, strong, em, ul, ol, li) but strip unsafe tags
    const safeHtml = decodeHtmlEntities(rawDesc)
      .replace(UNSAFE_TAGS, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/javascript:/gi, "")
      .trim();
    const fullDescriptionHtml = safeHtml || fullDescription;

    episodes.push({
      guid, title, description, fullDescription, fullDescriptionHtml, pubDate, pubDateISO,
      audioUrl, imageUrl, duration, episodeNumber, link,
    });
  });

  return { episodes, channelTitle, channelImage };
}

/**
 * Format an iTunes-style duration (HH:MM:SS or MM:SS or seconds) to a human
 * label like "45 min" or "1 hr 23 min".
 */
export function formatDuration(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(":").map((p) => parseInt(p, 10));
  let totalSeconds = 0;
  if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
  else if (parts.length === 1) totalSeconds = parts[0];
  else return raw;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} hr ${minutes} min`;
  return `${minutes} min`;
}

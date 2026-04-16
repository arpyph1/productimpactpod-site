// Substack RSS feed parser — fetched at build time for the Newsletter
// component. Astro is static-generation, so what was a runtime fetch in
// Lovable's React app becomes a build-time fetch here. Site rebuilds (every
// 6h via scheduled-rebuild.yml + on every publish) keep posts current.
//
// The fetch tries the feed URL directly first. Substack feeds are CORS-open
// from Node fetch, so unlike Lovable's browser code we don't need rss2json
// or allorigins as proxies.

export interface SubstackPost {
  title: string;
  link: string;
  pubDate: string;       // formatted "Apr 8, 2026"
  pubDateISO: string;    // raw ISO for sorting + machine-readable use
  description: string;   // first ~200 chars, plain text
}

const STRIP_HTML = /<[^>]*>/g;
const STRIP_CDATA = /<!\[CDATA\[|\]\]>/g;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function extractTag(item: string, tag: string): string {
  // Match <tag ...>content</tag> — non-greedy, allows attrs
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = item.match(re);
  if (!m) return "";
  return m[1].replace(STRIP_CDATA, "").trim();
}

function extractAttribute(item: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"[^>]*\\/?>`, "i");
  const m = item.match(re);
  return m ? m[1] : "";
}

/**
 * Fetch Substack feed at build time. Returns up to `limit` most-recent posts.
 * Returns [] on failure so the build never crashes — call site renders an
 * empty-state placeholder.
 */
export async function getSubstackPosts(
  substackUrl: string,
  limit = 6,
): Promise<SubstackPost[]> {
  if (!substackUrl) return [];

  const cleanUrl = substackUrl.trim().replace(/\/$/, "");
  const feedUrl = cleanUrl.endsWith("/feed")
    ? cleanUrl
    : `${cleanUrl}/feed`;

  let xml: string;
  try {
    const res = await fetch(feedUrl, {
      headers: {
        // Substack returns RSS XML for non-browser User-Agents reliably
        "User-Agent": "Mozilla/5.0 (productimpactpod build)",
        Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`Substack feed fetch ${feedUrl} → ${res.status}`);
      return [];
    }
    xml = await res.text();
  } catch (err) {
    console.warn(`Substack feed fetch failed (${feedUrl}):`, err);
    return [];
  }

  // Parse <item>…</item> blocks. Substack's feed is well-formed RSS 2.0.
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const posts: SubstackPost[] = [];

  for (const block of itemBlocks.slice(0, limit)) {
    const title = decodeHtmlEntities(extractTag(block, "title"));

    // <link> — Substack uses bare URL not <link>...</link> sometimes
    let link = extractTag(block, "link");
    if (!link) link = extractTag(block, "guid");
    link = link.trim();

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

    // Description — strip HTML, decode entities, truncate
    const rawDesc = extractTag(block, "description");
    const description = decodeHtmlEntities(rawDesc.replace(STRIP_HTML, ""))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    if (title && link) {
      posts.push({ title, link, pubDate, pubDateISO, description });
    }
  }

  return posts;
}

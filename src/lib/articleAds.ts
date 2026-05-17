// Fetch active article_ads from Supabase and inject their HTML into
// article body strings. Uses the public anon key — ads are public reads.

import { createClient } from "@supabase/supabase-js";

export interface ArticleAdBullet {
  label: string;
  url: string;
}

export interface ArticleAd {
  id: string;
  title: string;
  active: boolean;
  logo_url: string | null;
  logo_link: string | null;
  logo_alt: string | null;
  headline: string;
  eyebrow: string | null;
  bullets: ArticleAdBullet[];
  position_heading: number;
  display_order: number;
}

let _adsCache: ArticleAd[] | null = null;

export async function getActiveArticleAds(): Promise<ArticleAd[]> {
  if (_adsCache) return _adsCache;
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const sb = createClient(url, key);
  const { data } = await sb
    .from("article_ads")
    .select("*")
    .eq("active", true)
    .order("position_heading", { ascending: true })
    .order("display_order", { ascending: true });
  _adsCache = (data ?? []) as ArticleAd[];
  return _adsCache;
}

// Escape HTML entities in attribute values.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Append UTM tracking so the target site can attribute traffic back to
// productimpactpod.com. utm_content carries the bullet label so each
// CTA is distinguishable in the destination's analytics.
function withUtm(url: string, campaign: string, content?: string): string {
  if (!url || url === "#") return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("utm_source"))   u.searchParams.set("utm_source", "productimpactpod");
    if (!u.searchParams.has("utm_medium"))   u.searchParams.set("utm_medium", "article-ad");
    if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", campaign);
    if (content && !u.searchParams.has("utm_content")) u.searchParams.set("utm_content", content);
    return u.toString();
  } catch {
    return url;
  }
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function arrowSvg(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="color:#ff6b4a;opacity:0.7;flex-shrink:0"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`;
}

export function buildAdHtml(ad: ArticleAd): string {
  const campaign = slugify(ad.title) || "article-ad";
  const adId = esc(ad.id);

  const logoHtml = ad.logo_url
    ? `<a href="${esc(withUtm(ad.logo_link ?? "#", campaign, "logo"))}" target="_blank" rel="noopener sponsored" data-ad-id="${adId}" aria-label="${esc(ad.logo_alt ?? "Partner")}" class="ph1-ad-logo-link" style="display:block;opacity:0.9;flex-shrink:0;">
        <img src="${esc(ad.logo_url)}" alt="${esc(ad.logo_alt ?? "")}" loading="lazy" style="width:88px;height:auto;object-fit:contain;display:block;" />
      </a>`
    : "";

  const bulletsHtml = (ad.bullets ?? [])
    .map(b => `<li>
      <a href="${esc(withUtm(b.url, campaign, slugify(b.label)))}" target="_blank" rel="noopener sponsored" data-ad-id="${adId}"
        class="ph1-ad-bullet-link" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;margin:0 -12px;border-radius:8px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;transition:background 0.15s;">
        <span>${esc(b.label)}</span>${arrowSvg()}
      </a>
    </li>`)
    .join("");

  const eyebrowHtml = ad.eyebrow
    ? `<span style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#ff6b4a;margin-bottom:12px;">${esc(ad.eyebrow)}</span>`
    : "";

  // Mobile-first: single column with logo + headline side-by-side at the top,
  // bullets below. ≥768px: two columns with the logo + headline stacked on
  // the left as originally designed. Styles are embedded once per ad; the
  // class-scoped rules dedupe at parse and don't conflict between instances.
  return `
<aside class="not-prose ph1-ad" aria-label="Sponsored" style="margin:40px 0;">
  <style>
    .ph1-ad-grid { display:grid; grid-template-columns:1fr; gap:20px; }
    .ph1-ad-header { display:flex; flex-direction:row; align-items:center; gap:14px; }
    .ph1-ad-logo-img { height:28px; max-width:70px; }
    .ph1-ad-headline { margin:0; font-size:17px; font-weight:800; color:#fff; line-height:1.25; letter-spacing:-0.01em; }
    .ph1-ad-bullet-link:hover { background:rgba(255,255,255,0.06) !important; }
    .ph1-ad-logo-link:hover { opacity:0.75 !important; }
    @media (min-width:768px) {
      .ph1-ad-grid { grid-template-columns:auto 1fr; gap:24px; align-items:center; }
      .ph1-ad-header { flex-direction:column; align-items:flex-start; gap:16px; max-width:260px; }
      .ph1-ad-logo-img { height:44px; max-width:110px; }
      .ph1-ad-headline { font-size:18px; line-height:1.3; }
    }
  </style>
  <div style="position:relative;border-radius:16px;overflow:hidden;padding:28px;background:linear-gradient(135deg,#1a0a05 0%,#120808 30%,#0a0812 100%);">
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at top left,rgba(255,107,74,0.1),transparent 50%);pointer-events:none;"></div>
    <div style="position:relative;" class="ph1-ad-grid">
      <div class="ph1-ad-header">
        ${logoHtml}
        <h3 class="ph1-ad-headline">${esc(ad.headline)}</h3>
      </div>
      <div>
        ${eyebrowHtml}
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;">
          ${bulletsHtml}
        </ul>
      </div>
    </div>
  </div>
</aside>`;
}

// Inject ad HTML before the nth h2/h3 in article HTML. Mutiple ads are
// processed in ascending position_heading order; heading counts are
// accumulated across prior injections.
export function injectArticleAds(html: string, ads: ArticleAd[]): string {
  if (!ads.length) return html;

  const re = /<h[23](\s[^>]*)?>/gi;
  let result = "";
  let remaining = html;
  let headingsSeen = 0;
  let adIdx = 0;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  // Work on a clone of the regex against the full string so we can track positions.
  const fullRe = /<h[23](\s[^>]*)?>/gi;

  // Collect injection points: for each ad, which heading (cumulative) it's before.
  const targets = [...ads].sort((a, b) => a.position_heading - b.position_heading);

  let out = "";
  let pos = 0;
  let headingCount = 0;
  let targetIdx = 0;

  while (targetIdx < targets.length) {
    const target = targets[targetIdx];
    fullRe.lastIndex = pos;
    let found = false;

    while ((m = fullRe.exec(html)) !== null) {
      headingCount++;
      if (headingCount === target.position_heading) {
        out += html.slice(pos, m.index);
        out += buildAdHtml(target);
        pos = m.index;
        found = true;
        targetIdx++;
        break;
      }
    }

    if (!found) {
      // Not enough headings — append this ad at the end.
      out += html.slice(pos);
      out += buildAdHtml(target);
      pos = html.length;
      targetIdx++;
    }
  }

  out += html.slice(pos);
  return out;
}

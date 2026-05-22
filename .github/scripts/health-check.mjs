#!/usr/bin/env node
// Site health monitor for productimpactpod.com
// Runs ~80 checks across 12 categories; creates/updates/closes a GitHub
// issue labelled "monitoring-alert" based on pass/fail state.
//
// Required env vars:
//   SITE_URL              – defaults to https://productimpactpod.com
//   SUPABASE_URL          – GitHub secret (same as build-time value)
//   SUPABASE_ANON_KEY     – GitHub secret (PUBLIC_SUPABASE_ANON_KEY)
//   GH_TOKEN / GITHUB_TOKEN
//   GITHUB_REPOSITORY     – set automatically by GitHub Actions

import { appendFileSync } from 'node:fs';

const SITE        = (process.env.SITE_URL ?? 'https://productimpactpod.com').replace(/\/$/, '');
const SB_URL      = process.env.SUPABASE_URL ?? '';
const SB_KEY      = process.env.SUPABASE_ANON_KEY ?? '';
const GH_TOKEN    = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
const GH_REPO     = process.env.GITHUB_REPOSITORY ?? 'arpyph1/productimpactpod-site';
const TIMEOUT_MS  = 15_000;

// ─── Result accumulator ──────────────────────────────────────────────────────

/** @type {{ category: string, name: string, ok: boolean, reason?: string }[]} */
const results = [];
const pass = (cat, name)         => results.push({ category: cat, name, ok: true });
const fail = (cat, name, reason) => results.push({ category: cat, name, ok: false, reason });

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function httpGet(url, { authKey, extraHeaders = {}, timeout = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { 'User-Agent': 'productimpactpod-healthcheck/1.0', ...extraHeaders };
  if (authKey) {
    headers['apikey'] = authKey;
    headers['Authorization'] = `Bearer ${authKey}`;
  }
  try {
    const t0 = Date.now();
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    return { res, elapsed: Date.now() - t0 };
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e.name === 'AbortError' ? `Timed out (>${timeout}ms)` : e.message);
  }
}

async function fetchText(url, opts = {}) {
  const { res, elapsed } = await httpGet(url, opts);
  return { res, elapsed, body: await res.text() };
}

// ─── ① HTTP STATUS — every public route ──────────────────────────────────────

const HTTP = 'HTTP Status';

const ALL_ROUTES = [
  '/',
  '/news/',
  '/news/archive/',
  '/podcast/',
  '/episodes/',
  '/themes/',
  '/themes/ai-product-strategy/',
  '/themes/agents-agentic-systems/',
  '/themes/ux-experience-design-for-ai/',
  '/themes/adoption-organizational-change/',
  '/themes/evaluation-benchmarking/',
  '/themes/go-to-market-distribution/',
  '/themes/data-semantics-knowledge-foundations/',
  '/themes/governance-risk-trust/',
  '/topics/',
  '/tags/',
  '/people/',
  '/organizations/',
  '/products/',
  '/concepts/',
  '/frameworks/',
  '/sources/',
  '/about/',
  '/contact/',
  '/privacy/',
  '/terms/',
  '/partnerships/',
  '/admin/',
  '/rss.xml',
  '/news/rss.xml',
  '/sitemap.xml',
  '/sitemap-0.xml',
  '/news-sitemap.xml',
];

await Promise.all(ALL_ROUTES.map(async (path) => {
  try {
    const { res, elapsed } = await httpGet(SITE + path);
    if (res.status !== 200) fail(HTTP, path, `HTTP ${res.status}`);
    else if (elapsed > 8000) fail(HTTP, path, `Slow: ${elapsed}ms (threshold 8s)`);
    else pass(HTTP, `${path} (${elapsed}ms)`);
  } catch (e) {
    fail(HTTP, path, e.message);
  }
}));

// 404 guard — an unknown path must NOT return 200
try {
  const { res } = await httpGet(SITE + '/__no-such-page-xqz__/');
  if (res.status === 404) pass(HTTP, '404 guard (unknown path → 404)');
  else fail(HTTP, '404 guard', `Expected 404, got ${res.status}`);
} catch (e) {
  fail(HTTP, '404 guard', e.message);
}

// ─── ② HOMEPAGE ───────────────────────────────────────────────────────────────

const HOME = 'Homepage';
let homeHtml = '';

try {
  const { res, elapsed, body } = await fetchText(SITE + '/');
  homeHtml = body;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const hChecks = [
    [/<title>[^<]{5,}<\/title>/,                                                              '<title> tag present'],
    [/<meta\s[^>]*name=["']description["'][^>]*content=["'][^"']{20,}/i,                     'Meta description ≥20 chars'],
    [/<link\s[^>]*rel=["']canonical["']/,                                                     'Canonical link tag'],
    [/og:image|property=["']og:image["']/,                                                    'OG image meta tag'],
    [/application\/ld\+json/,                                                                 'JSON-LD schema block'],
    [/href="\/news\/[a-z0-9][a-z0-9-]+\/"/,                                                  'News article links present'],
    [/href="\/podcast\//,                                                                     'Podcast navigation link'],
    [/[Ss]ubscrib|[Nn]ewsletter|substack/,                                                    'Newsletter / subscribe section'],
    [/episode|Episode/,                                                                       'Episode content referenced'],
    [/href="\/themes\//,                                                                      'Themes navigation or section'],
  ];
  for (const [rx, label] of hChecks) {
    rx.test(homeHtml) ? pass(HOME, label) : fail(HOME, label, 'Pattern not found in HTML');
  }
  if (elapsed > 5000) fail(HOME, 'Load time', `${elapsed}ms — threshold 5s`);
  else pass(HOME, `Load time (${elapsed}ms)`);
} catch (e) {
  fail(HOME, 'Homepage HTML fetch', e.message);
}

// ─── ③ PODCAST PAGE ───────────────────────────────────────────────────────────

const POD = 'Podcast Page';
let podHtml = '';

try {
  const { res, elapsed, body } = await fetchText(SITE + '/podcast/');
  podHtml = body;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  // JSON island — episode data
  const islandRx = /<script[^>]+id="podcast-episodes-data"[^>]*>([\s\S]*?)<\/script>/;
  const islandMatch = podHtml.match(islandRx);
  if (!islandMatch) {
    fail(POD, 'Episode JSON island (#podcast-episodes-data)', 'Script tag not found in HTML');
  } else {
    try {
      const episodes = JSON.parse(islandMatch[1]);
      if (!Array.isArray(episodes) || episodes.length === 0) {
        fail(POD, 'Episode JSON island', `Present but empty or not an array`);
      } else {
        pass(POD, `Episode JSON island (${episodes.length} episodes serialised)`);
        const ep = episodes[0];

        // Field-level checks on first episode
        ep.title       ? pass(POD, 'Episode: title field')     : fail(POD, 'Episode: title field', 'title missing');
        ep.audioUrl    ? pass(POD, 'Episode: audioUrl field')   : fail(POD, 'Episode: audioUrl field', 'audioUrl missing — audio player will break');
        ep.imageUrl    ? pass(POD, 'Episode: imageUrl field')   : fail(POD, 'Episode: imageUrl field', 'imageUrl missing — thumbnail will break');
        ep.link        ? pass(POD, 'Episode: link field')       : fail(POD, 'Episode: link field', 'link missing');
        ep.fullDescriptionHtml ? pass(POD, 'Episode: fullDescriptionHtml') : fail(POD, 'Episode: fullDescriptionHtml', 'richtext body missing — modal will be empty');

        // Freshness: latest episode should be within 60 days
        if (ep.pubDate) {
          const days = (Date.now() - new Date(ep.pubDate).getTime()) / 86_400_000;
          if (isNaN(days)) fail(POD, 'Episode freshness', `Cannot parse pubDate: "${ep.pubDate}"`);
          else if (days > 60) fail(POD, 'Episode freshness', `Latest episode is ${Math.round(days)} days old (threshold 60)`);
          else pass(POD, `Episode freshness — latest ${Math.round(days)}d ago`);
        } else {
          fail(POD, 'Episode freshness', 'pubDate field missing on latest episode');
        }
      }
    } catch (e) {
      fail(POD, 'Episode JSON island', `JSON.parse failed: ${e.message}`);
    }
  }

  // Shorts section markup
  /short|Short|youtube-short/i.test(podHtml)
    ? pass(POD, 'YouTube Shorts section in markup')
    : fail(POD, 'YouTube Shorts section in markup', 'No shorts-related markup found');

  // Episode modal scaffold
  /episode-modal|id="episode-modal"/.test(podHtml)
    ? pass(POD, 'Episode modal element present')
    : fail(POD, 'Episode modal element present', '#episode-modal not found — modal JS will silently fail');

  // Hosts section
  /Arpy|Brittany|[Hh]ost/.test(podHtml)
    ? pass(POD, 'Hosts section present')
    : fail(POD, 'Hosts section present', '"Arpy", "Brittany", or "Host" not found');

  // Supabase edge function URL baked into script
  if (SB_URL) {
    podHtml.includes(SB_URL) || /get-latest-short/.test(podHtml)
      ? pass(POD, 'Edge function URL in client script')
      : fail(POD, 'Edge function URL in client script', 'get-latest-short call not found — shorts fetch may be broken');
  }

  if (elapsed > 5000) fail(POD, 'Load time', `${elapsed}ms — threshold 5s`);
  else pass(POD, `Load time (${elapsed}ms)`);
} catch (e) {
  fail(POD, 'Podcast page HTML fetch', e.message);
}

// ─── ④ NEWS INDEX + ARTICLE DRILL-DOWN ───────────────────────────────────────

const NEWS = 'News Page';
let firstArticlePath = '';

try {
  const { res, elapsed, body } = await fetchText(SITE + '/news/');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const articleLinks = [...body.matchAll(/href="(\/news\/[a-z0-9][a-z0-9-]+\/)"/g)].map(m => m[1]);
  articleLinks.length >= 5
    ? pass(NEWS, `Article listing (${articleLinks.length} links)`)
    : fail(NEWS, 'Article listing', `Only ${articleLinks.length} links — expected ≥5`);

  /format\/|news-brief|analysis|explainer/i.test(body)
    ? pass(NEWS, 'Format filter links present')
    : fail(NEWS, 'Format filter links', 'No format filter markup found');

  if (elapsed > 5000) fail(NEWS, 'Load time', `${elapsed}ms`);
  else pass(NEWS, `Load time (${elapsed}ms)`);

  firstArticlePath = articleLinks[0] ?? '';
} catch (e) {
  fail(NEWS, 'News page fetch', e.message);
}

// Article detail drill-down
const ART = 'Article Detail Page';
if (firstArticlePath) {
  try {
    const { res, body: ahtml } = await fetchText(SITE + firstArticlePath);
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${firstArticlePath}`);

    /<h1[^>]*>[^<]{10,}/.test(ahtml)      ? pass(ART, 'H1 with content')              : fail(ART, 'H1 with content', 'No <h1> with text ≥10 chars');
    /article-prose|<article/.test(ahtml)   ? pass(ART, 'Article body element')         : fail(ART, 'Article body element', 'article-prose or <article> not found');
    /<meta\s[^>]*name=["']description/.test(ahtml) ? pass(ART, 'Meta description')    : fail(ART, 'Meta description', 'Missing <meta name="description">');
    /og:image/.test(ahtml)                 ? pass(ART, 'OG image tag')                 : fail(ART, 'OG image tag', 'og:image meta missing');
    /<link\s[^>]*rel=["']canonical/.test(ahtml) ? pass(ART, 'Canonical link')         : fail(ART, 'Canonical link', 'Canonical link missing on article');

    // JSON-LD schema type check
    const ldBlock = ahtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!ldBlock) {
      fail(ART, 'JSON-LD schema', 'No <script type="application/ld+json"> found');
    } else {
      try {
        const ld = JSON.parse(ldBlock[1]);
        const schemas = Array.isArray(ld) ? ld : [ld];
        schemas.some(s => ['NewsArticle', 'Article'].includes(s['@type']))
          ? pass(ART, 'JSON-LD NewsArticle schema')
          : fail(ART, 'JSON-LD NewsArticle schema', `Types found: ${schemas.map(s => s['@type']).join(', ')}`);
        schemas.some(s => s['@type'] === 'BreadcrumbList')
          ? pass(ART, 'JSON-LD BreadcrumbList')
          : fail(ART, 'JSON-LD BreadcrumbList', 'No BreadcrumbList schema found');
      } catch {
        fail(ART, 'JSON-LD schema', 'JSON parse error');
      }
    }

    // Related articles sidebar
    /[Rr]elated|[Mm]ore [Aa]rticles|href="\/news\//.test(ahtml)
      ? pass(ART, 'Related articles / news links in sidebar')
      : fail(ART, 'Related articles / news links in sidebar', 'No related article links found on article page');
  } catch (e) {
    fail(ART, `Drill-down to ${firstArticlePath}`, e.message);
  }
} else {
  fail(ART, 'Article drill-down', 'No article path found on /news/ — news index may be broken');
}

// ─── ⑤ EPISODES ARCHIVE ──────────────────────────────────────────────────────

const EPS = 'Episodes Archive';
try {
  const { res, body } = await fetchText(SITE + '/episodes/');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const epLinks = [...body.matchAll(/href="(\/episodes\/[a-z0-9][a-z0-9-]+\/)"/g)];
  epLinks.length >= 5
    ? pass(EPS, `Episode grid (${epLinks.length} episode links)`)
    : fail(EPS, 'Episode grid', `Only ${epLinks.length} links — expected ≥5`);

  // Load-more button expected if many episodes
  /[Ll]oad [Mm]ore|load-more|show-more/.test(body)
    ? pass(EPS, 'Load-more pagination control present')
    : fail(EPS, 'Load-more pagination control', 'No load-more button found — paginated grid may be broken');
} catch (e) {
  fail(EPS, 'Episodes archive fetch', e.message);
}

// ─── ⑥ THEMES — all 8 ────────────────────────────────────────────────────────

const THM = 'Theme Pages';
const THEME_SLUGS = [
  'ai-product-strategy',
  'agents-agentic-systems',
  'ux-experience-design-for-ai',
  'adoption-organizational-change',
  'evaluation-benchmarking',
  'go-to-market-distribution',
  'data-semantics-knowledge-foundations',
  'governance-risk-trust',
];

// Themes index: all 8 theme links present
try {
  const { body } = await fetchText(SITE + '/themes/');
  const themeLinks = [...body.matchAll(/href="(\/themes\/[a-z][a-z-]+\/)"/g)].map(m => m[1]);
  themeLinks.length >= 8
    ? pass(THM, `Themes index (${themeLinks.length} themes listed)`)
    : fail(THM, 'Themes index', `Only ${themeLinks.length} themes — expected 8`);
  for (const slug of THEME_SLUGS) {
    themeLinks.some(l => l.includes(slug))
      ? pass(THM, `Theme link: ${slug}`)
      : fail(THM, `Theme link: ${slug}`, `/${slug}/ not found on /themes/ index`);
  }
} catch (e) {
  fail(THM, 'Themes index fetch', e.message);
}

// Spot-check one theme detail page
try {
  const { res, body } = await fetchText(SITE + '/themes/ai-product-strategy/');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const artLinks = [...body.matchAll(/href="\/news\/[a-z0-9][a-z0-9-]+\/"/g)];
  artLinks.length >= 1
    ? pass(THM, `Theme detail has articles (${artLinks.length} found)`)
    : fail(THM, 'Theme detail has articles', 'No /news/ links on /themes/ai-product-strategy/');
  /theme|Theme/.test(body)
    ? pass(THM, 'Theme detail page renders theme content')
    : fail(THM, 'Theme detail page', 'No "theme" text found — page may be blank');
} catch (e) {
  fail(THM, 'Theme detail (ai-product-strategy)', e.message);
}

// ─── ⑦ ENTITY INDEX PAGES ────────────────────────────────────────────────────

const ENT = 'Entity Index Pages';
const ENTITY_TYPES = ['people', 'organizations', 'products', 'concepts', 'frameworks', 'sources'];

await Promise.all(ENTITY_TYPES.map(async (type) => {
  try {
    const { res, body } = await fetchText(`${SITE}/${type}/`);
    if (!res.ok) { fail(ENT, `/${type}/`, `HTTP ${res.status}`); return; }
    const rx = new RegExp(`href="(\\/${type}\\/[a-z0-9][a-z0-9-]+\\/)"`, 'g');
    const links = [...body.matchAll(rx)];
    links.length > 0
      ? pass(ENT, `/${type}/ (${links.length} entries)`)
      : fail(ENT, `/${type}/`, 'No entity links found — table may be empty or RLS blocking');
  } catch (e) {
    fail(ENT, `/${type}/`, e.message);
  }
}));

// ─── ⑧ RSS FEEDS & SITEMAPS ───────────────────────────────────────────────────

const FEEDS = 'RSS & Sitemaps';

const XML_CHECKS = [
  ['/rss.xml',          ['<channel>', '<item>',       '<pubDate>'],             'Main RSS feed'],
  ['/news/rss.xml',     ['<channel>', '<item>',       '<pubDate>', '<title>'],  'News RSS feed'],
  ['/sitemap.xml',      ['<sitemapindex>'],                                      'Sitemap index'],
  ['/sitemap-0.xml',    ['<urlset>',  '<url>',        '<loc>'],                 'Main sitemap'],
  ['/news-sitemap.xml', ['<urlset>',  '<news:news>'],                           'Google News sitemap'],
];

const newsRssBody = { value: '' };

await Promise.all(XML_CHECKS.map(async ([path, tokens, label]) => {
  try {
    const { res, body } = await fetchText(SITE + path);
    if (!res.ok) { fail(FEEDS, label, `HTTP ${res.status}`); return; }
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('xml') && !body.trim().startsWith('<')) {
      fail(FEEDS, label, `Response is not XML (Content-Type: ${ct})`); return;
    }
    for (const token of tokens) {
      if (!body.includes(token)) { fail(FEEDS, label, `Missing element: ${token}`); return; }
    }
    pass(FEEDS, label);
    if (path === '/news/rss.xml') newsRssBody.value = body;
  } catch (e) {
    fail(FEEDS, label, e.message);
  }
}));

// News RSS freshness
if (newsRssBody.value) {
  const dates = [...newsRssBody.value.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)]
    .map(m => new Date(m[1]).getTime()).filter(t => !isNaN(t));
  if (dates.length === 0) {
    fail(FEEDS, 'News RSS freshness', 'No parseable <pubDate> elements');
  } else {
    const daysSince = (Date.now() - Math.max(...dates)) / 86_400_000;
    daysSince <= 30
      ? pass(FEEDS, `News RSS freshness — latest ${Math.round(daysSince)}d ago`)
      : fail(FEEDS, 'News RSS freshness', `Latest article pubDate is ${Math.round(daysSince)} days ago — threshold 30`);
  }
}

// Sitemap article count
try {
  const { body } = await fetchText(SITE + '/sitemap-0.xml');
  const urlCount = (body.match(/<url>/g) ?? []).length;
  urlCount >= 10
    ? pass(FEEDS, `Main sitemap URL count (${urlCount} <url> blocks)`)
    : fail(FEEDS, 'Main sitemap URL count', `Only ${urlCount} <url> blocks — expected ≥10`);
} catch (e) {
  fail(FEEDS, 'Sitemap URL count', e.message);
}

// ─── ⑨ EXTERNAL FEEDS (anchor.fm RSS + substack) ─────────────────────────────

const EXT = 'External Feeds';

async function checkExternalFeed(label, url) {
  try {
    const { res, body } = await fetchText(url, { timeout: 20_000 });
    if (!res.ok) { fail(EXT, label, `HTTP ${res.status}`); return; }
    const count = (body.match(/<item>/g) ?? []).length;
    count > 0
      ? pass(EXT, `${label} (${count} items)`)
      : fail(EXT, label, 'Feed parsed but contains 0 <item> elements');
  } catch (e) {
    fail(EXT, label, e.message);
  }
}

await checkExternalFeed('Podcast RSS (Anchor/Spotify)', 'https://anchor.fm/s/f32cce5c/podcast/rss');
await checkExternalFeed('Substack feed',                'https://productimpactpod.substack.com/feed');

// ─── ⑩ SUPABASE REST API ─────────────────────────────────────────────────────

const SB = 'Supabase API';

if (!SB_URL || !SB_KEY) {
  fail(SB, 'Credentials configured', 'SUPABASE_URL or SUPABASE_ANON_KEY secret not set in repo');
} else {
  const sbFetch = (path) => fetchText(`${SB_URL}${path}`, { authKey: SB_KEY });

  // Check a table has ≥1 accessible row
  async function checkTable(name, queryFilter = '') {
    try {
      const { res, body } = await sbFetch(`/rest/v1/${name}?select=*&limit=1${queryFilter}`);
      if (!res.ok) {
        fail(SB, `${name} table`, `HTTP ${res.status}: ${body.slice(0, 80)}`); return;
      }
      const data = JSON.parse(body);
      Array.isArray(data) && data.length > 0
        ? pass(SB, `${name} table (rows accessible)`)
        : fail(SB, `${name} table`, 'Empty array — table may be empty or RLS is blocking anon reads');
    } catch (e) {
      fail(SB, `${name} table`, e.message);
    }
  }

  await checkTable('articles',          '&published=eq.true');
  await checkTable('episode_shownotes', '&published=eq.true');
  await checkTable('themes');
  await checkTable('entities');
  await checkTable('site_settings');
  await checkTable('article_engagement');

  // Supabase edge function: get-latest-short
  try {
    const { res, body } = await fetchText(
      `${SB_URL}/functions/v1/get-latest-short?_ts=${Date.now()}`,
      { authKey: SB_KEY }
    );
    let parsed = null;
    try { parsed = JSON.parse(body); } catch { /* not JSON */ }

    if (res.status === 500) {
      fail(SB, 'get-latest-short edge fn', `HTTP 500 — YOUTUBE_API_KEY likely missing or quota exceeded: ${body.slice(0, 120)}`);
    } else if (!res.ok) {
      fail(SB, 'get-latest-short edge fn', `HTTP ${res.status}: ${body.slice(0, 120)}`);
    } else if (!Array.isArray(parsed?.shorts)) {
      fail(SB, 'get-latest-short edge fn', `Response missing "shorts" array: ${body.slice(0, 120)}`);
    } else if (parsed.shorts.length === 0) {
      fail(SB, 'get-latest-short edge fn', 'Returned 0 shorts — no recent YouTube Shorts found');
    } else {
      const s = parsed.shorts[0];
      pass(SB, `get-latest-short edge fn (${parsed.shorts.length} shorts)`);
      s.videoId    ? pass(SB, 'Short: videoId present')    : fail(SB, 'Short: videoId',    'videoId missing on first short');
      s.title      ? pass(SB, 'Short: title present')      : fail(SB, 'Short: title',      'title missing');
      s.thumbnail  ? pass(SB, 'Short: thumbnail present')  : fail(SB, 'Short: thumbnail',  'thumbnail URL missing — card will break');
    }
  } catch (e) {
    fail(SB, 'get-latest-short edge fn', e.message);
  }
}

// ─── ⑪ SEO & SCHEMA ──────────────────────────────────────────────────────────

const SEO = 'SEO & Schema';

// Helper: extract and parse all JSON-LD blocks from HTML
function parseAllLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap(m => { try { const p = JSON.parse(m[1]); return Array.isArray(p) ? p : [p]; } catch { return []; } });
}

// Homepage JSON-LD
if (homeHtml) {
  const schemas = parseAllLd(homeHtml);
  const types = schemas.map(s => s['@type']).filter(Boolean);
  types.includes('WebSite') || types.includes('Organization') || types.length > 0
    ? pass(SEO, `Homepage JSON-LD (types: ${types.join(', ')})`)
    : fail(SEO, 'Homepage JSON-LD', 'No JSON-LD schemas found or @type missing');
}

// Podcast page JSON-LD
try {
  const html = podHtml || (await fetchText(SITE + '/podcast/')).body;
  const schemas = parseAllLd(html);
  const podcastTypes = ['PodcastSeries', 'Podcast', 'RadioSeries'];
  schemas.some(s => podcastTypes.includes(s['@type']))
    ? pass(SEO, `Podcast JSON-LD (PodcastSeries schema)`)
    : fail(SEO, 'Podcast JSON-LD', `No PodcastSeries type. Found: ${schemas.map(s => s['@type']).join(', ') || 'none'}`);
} catch (e) {
  fail(SEO, 'Podcast page JSON-LD', e.message);
}

// Homepage: Google Analytics snippet
if (homeHtml) {
  /gtag|google-analytics|G-[A-Z0-9]+/.test(homeHtml)
    ? pass(SEO, 'Google Analytics snippet present')
    : fail(SEO, 'Google Analytics snippet', 'No gtag or GA ID found — analytics tracking may be broken');
}

// ─── ⑫ ADMIN ROUTE ───────────────────────────────────────────────────────────

const ADM = 'Admin Route';
try {
  const { res, body } = await fetchText(SITE + '/admin/');
  if (res.status === 200) {
    pass(ADM, '/admin/ returns 200');
    /AdminApp|supabase-js|react/.test(body)
      ? pass(ADM, 'Admin React app bundle referenced')
      : fail(ADM, 'Admin React app bundle', 'No React/Supabase reference found — admin JS may have been stripped');
  } else {
    fail(ADM, '/admin/ returns 200', `Got HTTP ${res.status}`);
  }
} catch (e) {
  fail(ADM, '/admin/ accessibility', e.message);
}

// ─── BUILD REPORT ─────────────────────────────────────────────────────────────

const failures = results.filter(r => !r.ok);
const categories = [...new Set(results.map(r => r.category))];
const runTs = new Date().toUTCString();

let report = `## 🩺 Site Health Report — ${runTs}\n\n`;
report += `| | |\n|---|---|\n`;
report += `| **Total checks** | ${results.length} |\n`;
report += `| **Passed** | ✅ ${results.length - failures.length} |\n`;
report += `| **Failed** | ${failures.length > 0 ? `❌ **${failures.length}**` : '✅ 0'} |\n\n`;

if (failures.length > 0) {
  report += `### ❌ Failures\n\n`;
  for (const f of failures) {
    report += `- **[${f.category}]** ${f.name}: \`${f.reason}\`\n`;
  }
  report += `\n`;
}

report += `### Results by category\n\n`;
for (const cat of categories) {
  const catR = results.filter(r => r.category === cat);
  const catF = catR.filter(r => !r.ok);
  const icon = catF.length > 0 ? '❌' : '✅';
  report += `<details><summary>${icon} ${cat} — ${catR.length - catF.length}/${catR.length} passed</summary>\n\n`;
  for (const r of catR) {
    report += r.ok
      ? `- ✅ ${r.name}\n`
      : `- ❌ **${r.name}** — \`${r.reason}\`\n`;
  }
  report += `\n</details>\n\n`;
}

report += `---\n*Auto-generated · [Workflow run](https://github.com/${GH_REPO}/actions) · ${runTs}*\n`;

console.log(report);

// ─── GITHUB ISSUE MANAGEMENT ──────────────────────────────────────────────────

if (GH_TOKEN) {
  const ghH = {
    Authorization:          `Bearer ${GH_TOKEN}`,
    'Content-Type':         'application/json',
    'User-Agent':           'productimpactpod-healthcheck',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const ghFetch = (path, opts = {}) =>
    fetch(`https://api.github.com/repos/${GH_REPO}${path}`, { headers: ghH, ...opts });

  // Ensure label exists
  try {
    const r = await ghFetch('/labels/monitoring-alert');
    if (r.status === 404) {
      await ghFetch('/labels', {
        method: 'POST',
        body: JSON.stringify({ name: 'monitoring-alert', color: 'ee0701', description: 'Site health check failure' }),
      });
    }
  } catch { /* non-fatal */ }

  // Find open alert issue
  let openIssueNumber = null;
  try {
    const r = await ghFetch('/issues?state=open&labels=monitoring-alert&per_page=1');
    const issues = await r.json();
    if (Array.isArray(issues) && issues.length > 0) openIssueNumber = issues[0].number;
  } catch { /* non-fatal */ }

  if (failures.length > 0) {
    const title = `🚨 Site health: ${failures.length} check${failures.length !== 1 ? 's' : ''} failing — ${new Date().toISOString().slice(0, 10)}`;
    if (openIssueNumber) {
      await ghFetch(`/issues/${openIssueNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: report }),
      });
      await ghFetch(`/issues/${openIssueNumber}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      console.error(`Updated open issue #${openIssueNumber}`);
    } else {
      const r = await ghFetch('/issues', {
        method: 'POST',
        body: JSON.stringify({ title, body: report, labels: ['monitoring-alert'] }),
      });
      const issue = await r.json();
      if (issue.number) console.error(`Created issue #${issue.number}: ${issue.html_url}`);
      else console.error(`Failed to create issue: ${JSON.stringify(issue).slice(0, 200)}`);
    }
  } else if (openIssueNumber) {
    // All clear — close the standing alert
    await ghFetch(`/issues/${openIssueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: `✅ All ${results.length} checks passing as of ${runTs}. Closing alert.` }),
    });
    await ghFetch(`/issues/${openIssueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    });
    console.log(`Closed resolved alert issue #${openIssueNumber}`);
  }
}

// Write GITHUB_OUTPUT for optional downstream steps
const gho = process.env.GITHUB_OUTPUT;
if (gho) {
  const delimiter = `ghadelim_${Date.now()}`;
  appendFileSync(gho, `failures=${failures.length}\n`);
  appendFileSync(gho, `report<<${delimiter}\n${report}\n${delimiter}\n`);
}

process.exit(failures.length > 0 ? 1 : 0);

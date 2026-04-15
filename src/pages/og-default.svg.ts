// Default OG image served as SVG.
// Most crawlers (Google, Slack, Discord, LinkedIn, Telegram) accept SVG.
// Twitter/X requires JPEG or PNG — replace this with a real PNG export once
// brand assets are finalised. Export by opening /og-default.svg in Chrome
// → right-click → Save as image → export 1200×628 PNG → place in /public/og-default.png
// then delete this file and revert BaseLayout to /og-default.png.

import type { APIRoute } from "astro";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 628" width="1200" height="628">
  <rect width="1200" height="628" fill="#0a0a0a"/>
  <rect width="1200" height="8" fill="#ff6b4a"/>
  <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.04"/>
  </pattern>
  <rect width="1200" height="628" fill="url(#grid)"/>
  <radialGradient id="glow" cx="50%" cy="50%" r="60%">
    <stop offset="0%" stop-color="#ff6b4a" stop-opacity="0.08"/>
    <stop offset="100%" stop-color="#0a0a0a" stop-opacity="0"/>
  </radialGradient>
  <rect width="1200" height="628" fill="url(#glow)"/>
  <circle cx="600" cy="218" r="56" fill="#1a1a1a"/>
  <circle cx="600" cy="218" r="44" fill="#ff6b4a" opacity="0.2"/>
  <text x="600" y="230" font-family="system-ui,-apple-system,sans-serif" font-size="32" font-weight="800" fill="#ff6b4a" text-anchor="middle">PI</text>
  <text x="600" y="328" font-family="system-ui,-apple-system,sans-serif" font-size="52" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-1">Product Impact</text>
  <text x="600" y="388" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="400" fill="#a0a0a0" text-anchor="middle">AI product news, releases, and case studies</text>
  <text x="600" y="558" font-family="system-ui,-apple-system,sans-serif" font-size="18" font-weight="600" fill="#ff6b4a" text-anchor="middle" letter-spacing="0.5">productimpactpod.com</text>
</svg>`;

export const GET: APIRoute = () => {
  return new Response(SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
};

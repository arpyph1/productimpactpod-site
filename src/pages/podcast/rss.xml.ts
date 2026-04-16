// Redirect podcast RSS to the Anchor/Spotify feed.
// This gives us a stable /podcast/rss.xml URL while the actual feed is hosted by Anchor.

import type { APIContext } from "astro";

export function GET(_ctx: APIContext) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://anchor.fm/s/f32cce5c/podcast/rss",
    },
  });
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 9999;
  return (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseInt(m[3] || "0");
}

interface ShortInfo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId, count = 2 } = await req.json();
    if (!channelId) {
      return new Response(
        JSON.stringify({ error: "channelId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "YouTube API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Search API — reliably returns all videos including Shorts
    // that the playlistItems endpoint sometimes misses.
    // Costs 100 quota units (vs 1 for playlistItems) but within daily 10k limit.
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelId)}&type=video&order=date&maxResults=50&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      console.error("YouTube Search API error:", JSON.stringify(searchData));
      return new Response(
        JSON.stringify({ error: "YouTube API error", details: searchData.error?.message || "Unknown error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const items = searchData.items || [];
    if (items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No videos found", shorts: [], mostWatched: null }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get video details (duration + statistics) for all found videos
    const videoIds = items.map((item: any) => item.id?.videoId).filter(Boolean);
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${videoIds.join(",")}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (!detailsRes.ok) {
      console.error("YouTube Videos API error:", JSON.stringify(detailsData));
      return new Response(
        JSON.stringify({ error: "YouTube API error fetching video details" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const detailsMap = new Map<string, any>();
    for (const v of (detailsData.items || [])) {
      detailsMap.set(v.id, v);
    }

    // Collect Shorts (≤180s / 3min)
    const allShorts: ShortInfo[] = [];

    for (const item of items) {
      const vid = item.id?.videoId;
      const detail = detailsMap.get(vid);
      if (!detail) continue;
      const duration = parseDuration(detail.contentDetails?.duration || "");
      if (duration <= 180) {
        allShorts.push({
          videoId: vid,
          title: detail.snippet?.title || "",
          thumbnail: detail.snippet?.thumbnails?.high?.url || detail.snippet?.thumbnails?.medium?.url || "",
          publishedAt: detail.snippet?.publishedAt || "",
          viewCount: parseInt(detail.statistics?.viewCount || "0"),
        });
      }
    }

    if (allShorts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No Shorts found (videos ≤3min) in the latest uploads", shorts: [], mostWatched: null }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Latest shorts by publish date
    allShorts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const shorts = allShorts.slice(0, count).map(({ viewCount, ...s }) => s);

    // Most watched short by view count
    const mostWatched = [...allShorts].sort((a, b) => b.viewCount - a.viewCount)[0];
    const mostWatchedResult = mostWatched
      ? { videoId: mostWatched.videoId, title: mostWatched.title, thumbnail: mostWatched.thumbnail, publishedAt: mostWatched.publishedAt }
      : null;

    return new Response(
      JSON.stringify({ shorts, mostWatched: mostWatchedResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

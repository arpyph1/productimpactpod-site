# `get-latest-short` edge function

Returns the two most-recent YouTube Shorts + the highest-viewed Short
from a public YouTube channel. Called at build time by `/podcast.astro`.

## Deploy

### Option 1 — via the Supabase dashboard (no CLI needed)

1. Supabase dashboard → your project → **Edge Functions** → **Create a new function**
2. Name: `get-latest-short`
3. Paste the contents of `index.ts` into the editor
4. Click **Deploy**

### Option 2 — via Supabase CLI

```bash
# From the repo root:
supabase functions deploy get-latest-short \
  --project-ref <your-project-ref>
```

## Required secret

The function reads `YOUTUBE_API_KEY` from its environment.

Create a YouTube Data API v3 key:

1. Open [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or reuse one)
3. **APIs & Services** → **Library** → search "YouTube Data API v3" → **Enable**
4. **APIs & Services** → **Credentials** → **Create credentials** → **API key**
5. Restrict the key:
   - **Application restrictions**: HTTP referrers or leave unrestricted for server-side use
   - **API restrictions**: YouTube Data API v3 only

Then add it as a function secret:

**Dashboard:**
Supabase → Edge Functions → `get-latest-short` → **Secrets** → Add
- Name: `YOUTUBE_API_KEY`
- Value: the key you created

**CLI:**
```bash
supabase secrets set YOUTUBE_API_KEY=AIza... --project-ref <your-project-ref>
```

## Verify

```bash
curl -X POST https://<your-project>.supabase.co/functions/v1/get-latest-short \
  -H "apikey: $PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"channelId":"UCb1nY02YcJYZZ_XtvcIBcrw","count":2}'
```

Should return JSON like:
```json
{
  "shorts": [
    {"videoId":"abc123","title":"…","thumbnail":"…","publishedAt":"…"},
    {"videoId":"def456","title":"…","thumbnail":"…","publishedAt":"…"}
  ],
  "mostWatched": {"videoId":"xyz789","title":"…","thumbnail":"…","publishedAt":"…"}
}
```

If you get `{"error":"YouTube API key not configured"}` — the
`YOUTUBE_API_KEY` secret isn't set.

## Cost

YouTube Data API v3 has a 10,000 quota units/day free tier. Each call to
this function uses ~4 units (one `playlistItems` + one `videos` request).
At a CF Pages rebuild every 6 hours, that's 16 calls/day ≈ 64 units —
well inside the free tier.

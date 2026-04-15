# Fresh Supabase setup — runbook

Step-by-step guide for standing up a brand-new Supabase project under
your own account (e.g. `info@productimpactpod.com`), replacing the
Lovable-era project that you don't have direct access to.

**Time estimate:** 30–45 minutes end-to-end.

---

## What you're creating

A new Supabase project that the Astro site reads from at build time.
The project will contain:

- All the tables the site queries (articles, entities, article_entities,
  themes, lenses, episode_shownotes, etc.) — schema in
  `supabase/migrations/0001_initial_schema.sql`
- The 8 canonical themes and 4 canonical lenses, seeded
- Two host entity rows (`arpy-dragffy`, `brittany-hobbs`)
- A public Storage bucket `article-heroes` for AI-generated hero images
- The `get-latest-short` edge function for YouTube Shorts integration
- RLS policies letting the site read published content via the anon key

You keep: all the Astro site code, the Cloudflare Pages deployment,
the publishing pipeline in `scripts/publishing/`, and the vault-system
integration.

You lose: the Lovable-era article corpus (if any was published).
Everything published on the new project must go through
`publish_articles.py` in vault-system.

---

## Phase A — Create the Supabase project (~5 min)

1. Go to **https://supabase.com/dashboard**
2. Sign up (or sign in) with `info@productimpactpod.com`
3. Click **New project**
4. Fill in:
   - **Name:** `productimpactpod` (or similar)
   - **Database password:** generate a strong random one — **save it to
     your password manager immediately** (you can't retrieve it later)
   - **Region:** choose closest to your primary traffic (US East / US
     West for North America; eu-west-1 / eu-central-1 for Europe)
   - **Pricing plan:** Free tier is fine to start; upgrade later if you
     hit limits (500 MB storage, 500 MB database, 5 GB egress/mo)
5. Click **Create new project**
6. Wait ~90 seconds for provisioning to complete

---

## Phase B — Capture your project credentials

Once the project is provisioned, copy these down **somewhere safe** (a
password manager note for the project works well):

From Dashboard → **Settings** → **API**:
- **Project URL** — looks like `https://abcdefghijklmnop.supabase.co`
- **anon / public key** — a long JWT starting with `eyJhbGciOiJIUzI1NiI…`
- **service_role / secret key** — another long JWT (reveal first, then
  copy) — **treat as a password, never commit**

From Dashboard → **Settings** → **General**:
- **Reference ID** — the short string in the URL (`abcdefghijklmnop`)

---

## Phase C — Apply the schema (~5 min)

### C.1 Run the initial schema migration

Dashboard → **SQL Editor** → **New query**.

Open `supabase/migrations/0001_initial_schema.sql` from this repo,
copy the **entire contents**, paste into the SQL Editor, and click
**Run** (or press Cmd+Enter).

You should see a success message with no errors.

### C.2 Run the site bootstrap

Still in the SQL Editor, **New query** again.

Open `supabase/migrations/0002_site_bootstrap.sql`, copy everything,
paste, and **Run**.

The last statement returns a summary row that should look like:

| bucket_exists | host_rows | theme_count | lens_count | anon_policies |
|---|---|---|---|---|
| 1 | 2 | 8 | 4 | 6 |

If any number is off, paste the output here and we'll debug.

---

## Phase D — Deploy the edge function (~5 min)

The `get-latest-short` function powers the YouTube Shorts block on
`/podcast`. The source lives at
`supabase/functions/get-latest-short/index.ts`.

### D.1 Create a YouTube Data API v3 key

1. Open **https://console.cloud.google.com**
2. Create a new project (e.g. "productimpactpod")
3. **APIs & Services** → **Library** → search "YouTube Data API v3"
   → click it → **Enable**
4. **APIs & Services** → **Credentials** → **Create credentials**
   → **API key**
5. (Recommended) **Edit API key** → **API restrictions** →
   **Restrict key** → select only "YouTube Data API v3" → **Save**
6. Copy the key

### D.2 Deploy the function via dashboard

1. Supabase Dashboard → **Edge Functions** → **Create a new function**
2. **Name:** `get-latest-short`
3. **Verify JWT:** leave checked (default — anon key is required)
4. Click the newly-created function to open the editor
5. Delete the default code
6. Paste the contents of `supabase/functions/get-latest-short/index.ts`
7. Click **Deploy**

### D.3 Add the YouTube API key as a function secret

1. Edge Functions → `get-latest-short` → **Secrets** → **Add secret**
2. **Name:** `YOUTUBE_API_KEY`
3. **Value:** paste the key from D.1
4. Click **Save**

### D.4 Test the function

From your terminal:

```bash
export PUBLIC_SUPABASE_URL="https://<your-ref>.supabase.co"
export PUBLIC_SUPABASE_ANON_KEY="<anon key from Phase B>"

curl -X POST "$PUBLIC_SUPABASE_URL/functions/v1/get-latest-short" \
  -H "apikey: $PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"channelId":"UCb1nY02YcJYZZ_XtvcIBcrw","count":2}'
```

Expected: JSON with `shorts: [...]` and `mostWatched: {...}`.

If you see `{"error":"YouTube API key not configured"}` → the
`YOUTUBE_API_KEY` secret isn't set (D.3).

---

## Phase E — Point the site at the new project (~10 min)

The site currently points at the old Lovable Supabase URL (hardcoded
fallback was removed in the migration branch, but local `.env` may
still have old values).

### E.1 Update the Cloudflare Pages environment

1. Cloudflare Dashboard → **Workers & Pages** → `productimpactpod-site`
   → **Settings** → **Environment variables** → **Add variable**
2. Add under **Production** (and **Preview** too if you want branch
   previews to hit the real DB):

   | Variable | Value |
   |---|---|
   | `PUBLIC_SUPABASE_URL` | `https://<your-ref>.supabase.co` |
   | `PUBLIC_SUPABASE_ANON_KEY` | *paste anon key from Phase B* |

3. Click **Save**

### E.2 Update your local .env

```bash
cd ~/code/productimpactpod-site
cp .env.example .env
# Edit .env — paste your real values for:
#   PUBLIC_SUPABASE_URL
#   PUBLIC_SUPABASE_ANON_KEY
```

### E.3 Merge the migration branch (if not already)

```bash
# If you haven't already merged claude/supabase-fresh-setup to main:
gh pr view  # or visit the PR on github.com
# Review, approve, merge.
```

After merge, a fresh Cloudflare Pages deployment fires. Wait ~2 min,
then verify the site built successfully:

https://productimpactpod-site.pages.dev

---

## Phase F — Verify everything ▄

Run the one-shot verifier with your new credentials:

```bash
cd ~/code/productimpactpod-site
export PUBLIC_SUPABASE_ANON_KEY="<anon key>"
export SUPABASE_SERVICE_ROLE_KEY="<service_role key>"

python3 scripts/publishing/verify_supabase.py --verbose
```

⚠️ **Before running, edit `scripts/publishing/verify_supabase.py`** and
change `DEFAULT_SUPABASE_URL` to your new project URL — OR export
`PUBLIC_SUPABASE_URL` as an env var so it picks up the right project.

Expected final line:
```
✓ All checks passed — site is ready to publish.
```

If anything fails → paste output, we'll debug.

---

## Phase G — Trigger a fresh deployment ▄

The site builds at deploy time, so we need one rebuild to pick up the
new Supabase content (even if just theme descriptions for now).

Option 1 — from GitHub Actions:

```
https://github.com/arpyph1/productimpactpod-site/actions
→ Scheduled CF Pages rebuild → Run workflow
```

Option 2 — manual from Cloudflare dashboard:
Pages → productimpactpod-site → **Deployments** → **Retry deployment**
on the latest.

After ~2 min, verify:

```bash
# Homepage should render (though news listings will be empty until
# first publish)
curl -sI https://productimpactpod-site.pages.dev/ | head -1

# Themes page should show all 8 themes
curl -s https://productimpactpod-site.pages.dev/themes/ | \
  grep -c 'AI Product Strategy\|Agents & Agentic\|UX & Experience'
# Should return at least 3 (grep -c)

# Hosts should render
curl -sI https://productimpactpod-site.pages.dev/people/arpy-dragffy/ | head -1
# HTTP/2 200

# Edge function check
curl -s https://productimpactpod-site.pages.dev/podcast/ | \
  grep -c 'short-card'
# Should return > 0 if the edge function is live and YOUTUBE_API_KEY is set
```

---

## Phase H — Ready to publish

The pipeline is now fully wired end-to-end:

```
Vault draft → publish_articles.py → validates →
  generates hero image (Flux) → uploads to article-heroes bucket →
  INSERT into articles → dispatch_rebuild.py → GitHub Actions →
  Cloudflare Pages rebuild → live on productimpactpod.com/news/...
```

Move on to the vault-system integration (Phase 4 from the earlier
runbook): add the site repo as a submodule, run `scaffold-vault.sh`,
customise `parse_vault_markdown()`, publish your first article.

---

## Troubleshooting

### Schema migration errored

- If you see `type "entity_type" already exists`, you re-ran 0001 twice.
  That's fine — `CREATE TYPE` is not idempotent, but everything after the
  types is. To reset, drop the tables and re-run the whole file:

  ```sql
  DROP TABLE IF EXISTS
    public.article_entities, public.episode_entities, public.article_faqs,
    public.episode_faqs, public.articles, public.entities, public.themes,
    public.lenses, public.sponsors, public.episode_shownotes,
    public.user_roles, public.profiles CASCADE;

  DROP TYPE IF EXISTS public.entity_type, public.app_role CASCADE;
  DROP FUNCTION IF EXISTS public.has_role, public.handle_new_user,
                         public.auto_assign_admin CASCADE;
  ```

  Then re-run 0001.

### verify_supabase.py says "Host not in allowlist"

The site code used to have a hardcoded fallback URL. The migration
removes it — but the verifier uses its own default. Export the new URL:

```bash
export PUBLIC_SUPABASE_URL="https://<your-ref>.supabase.co"
```

### CF Pages build fails with "PUBLIC_SUPABASE_URL must be set"

Phase E.1 step missing. Add both env vars to the CF Pages project
settings, then trigger a rebuild.

### Podcast page shows "unavailable" for all three Shorts

Either the edge function isn't deployed (Phase D.2), or
`YOUTUBE_API_KEY` isn't set (D.3), or the Cloudflare Pages build was
cached before the edge function came online. Retry from Phase G.

### Article page returns 404 after publish

Check the CF Pages deployment log — the dispatch may have fired before
Supabase committed the new row. Wait 30 seconds and retry the rebuild.

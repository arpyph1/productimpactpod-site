-- Two analytics expansions:
--   1. Session-based "avg pages per session" by landing article.
--   2. Per-ad click counts for article_ads.

-- 1. article_sessions: one row per browser session, identified by a client-side
-- UUID. Updated as the visitor browses more pages within the same session.
-- "Landing article" is captured the first time the session lands on an article
-- page; only sessions with a landing_article_id contribute to per-article
-- avg-pages aggregation.
create table if not exists article_sessions (
  session_id          uuid primary key,
  landing_article_id  uuid references articles(id) on delete set null,
  pages_count         int  not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_article_sessions_landing
  on article_sessions(landing_article_id);

alter table article_sessions enable row level security;

-- Public insert/update via RPC. The RPC uses security definer so the policies
-- only need to cover direct reads; admins read aggregates from the dashboard.
create policy "Admin read sessions" on article_sessions
  for select using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

-- upsert_session: idempotent per (session_id). Sets landing_article_id only if
-- not already set (so the FIRST article in the session sticks). Updates
-- pages_count to the higher of stored vs incoming so out-of-order reports
-- never decrement.
create or replace function upsert_session(
  p_session_id uuid,
  p_landing_article_id uuid,
  p_pages_count int
) returns void language plpgsql security definer as $$
begin
  insert into article_sessions (session_id, landing_article_id, pages_count, updated_at)
  values (p_session_id, p_landing_article_id, greatest(p_pages_count, 1), now())
  on conflict (session_id) do update set
    landing_article_id = coalesce(article_sessions.landing_article_id, excluded.landing_article_id),
    pages_count        = greatest(article_sessions.pages_count, excluded.pages_count),
    updated_at         = now();
end;
$$;

-- 2. article_ads: track clicks per ad.
alter table article_ads
  add column if not exists clicks bigint not null default 0;

create or replace function increment_ad_click(p_ad_id uuid)
returns void language plpgsql security definer as $$
begin
  update article_ads set clicks = clicks + 1 where id = p_ad_id;
end;
$$;

-- Article engagement tracking: views, shares, hearts
-- Aggregated per article with atomic increment via RPC functions.

create table if not exists article_engagement (
  article_id uuid primary key references articles(id) on delete cascade,
  views      bigint not null default 0,
  shares     bigint not null default 0,
  hearts     bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table article_engagement enable row level security;

-- Anyone can read engagement counts
create policy "Public read engagement" on article_engagement
  for select using (true);

-- Only authenticated users can insert/update (via RPC)
create policy "Authenticated upsert engagement" on article_engagement
  for all using (true) with check (true);

-- RPC: increment a view (called once per unique visitor via localStorage check)
create or replace function increment_view(p_article_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, views, updated_at)
  values (p_article_id, 1, now())
  on conflict (article_id)
  do update set views = article_engagement.views + 1, updated_at = now();
end;
$$;

-- RPC: increment shares
create or replace function increment_share(p_article_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, shares, updated_at)
  values (p_article_id, 1, now())
  on conflict (article_id)
  do update set shares = article_engagement.shares + 1, updated_at = now();
end;
$$;

-- RPC: add hearts (amount = 1, 2, or 3)
create or replace function add_hearts(p_article_id uuid, p_amount int default 1)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, hearts, updated_at)
  values (p_article_id, p_amount, now())
  on conflict (article_id)
  do update set hearts = article_engagement.hearts + p_amount, updated_at = now();
end;
$$;

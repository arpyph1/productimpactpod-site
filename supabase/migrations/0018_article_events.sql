-- Event log for time-series article analytics. Each tracked action writes
-- both to its running-total table (article_engagement / article_sessions)
-- AND to article_events so the admin can chart per-day performance.
--
-- Charts populate from this migration's deploy date forward; existing
-- aggregate totals are still visible as lifetime numbers in the detail UI.

create table if not exists article_events (
  id          bigserial primary key,
  article_id  uuid not null references articles(id) on delete cascade,
  event_type  text not null check (event_type in ('view','share','heart','link_click','read_pct')),
  amount      int  not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists idx_article_events_article_day
  on article_events(article_id, created_at);
create index if not exists idx_article_events_type_day
  on article_events(event_type, created_at);

alter table article_events enable row level security;

create policy "Admin read article events" on article_events
  for select using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

-- All inserts go through security-definer RPCs below; no public insert policy.

create or replace function increment_view(p_article_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, views, updated_at)
  values (p_article_id, 1, now())
  on conflict (article_id) do update set views = article_engagement.views + 1, updated_at = now();
  insert into article_events (article_id, event_type, amount) values (p_article_id, 'view', 1);
end;
$$;

create or replace function increment_share(p_article_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, shares, updated_at)
  values (p_article_id, 1, now())
  on conflict (article_id) do update set shares = article_engagement.shares + 1, updated_at = now();
  insert into article_events (article_id, event_type, amount) values (p_article_id, 'share', 1);
end;
$$;

create or replace function add_hearts(p_article_id uuid, p_amount int default 1)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, hearts, updated_at)
  values (p_article_id, p_amount, now())
  on conflict (article_id) do update set hearts = article_engagement.hearts + p_amount, updated_at = now();
  insert into article_events (article_id, event_type, amount) values (p_article_id, 'heart', p_amount);
end;
$$;

create or replace function record_read_pct(p_article_id uuid, p_pct int)
returns void language plpgsql security definer as $$
begin
  if p_pct is null or p_pct < 1 or p_pct > 100 then return; end if;
  insert into article_engagement (article_id, read_pct_sum, read_pct_count, updated_at)
  values (p_article_id, p_pct, 1, now())
  on conflict (article_id) do update set
    read_pct_sum   = article_engagement.read_pct_sum   + p_pct,
    read_pct_count = article_engagement.read_pct_count + 1,
    updated_at     = now();
  insert into article_events (article_id, event_type, amount) values (p_article_id, 'read_pct', p_pct);
end;
$$;

create or replace function increment_link_click(p_article_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, link_clicks, updated_at)
  values (p_article_id, 1, now())
  on conflict (article_id) do update set link_clicks = article_engagement.link_clicks + 1, updated_at = now();
  insert into article_events (article_id, event_type, amount) values (p_article_id, 'link_click', 1);
end;
$$;

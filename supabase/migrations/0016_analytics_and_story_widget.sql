-- Article analytics expansion: average % of article read, outbound link clicks.
-- Story submission widget: editable singleton config + anonymous submissions.

-- 1. Extend article_engagement with read % and link click tallies.
alter table article_engagement
  add column if not exists read_pct_sum   bigint not null default 0,
  add column if not exists read_pct_count bigint not null default 0,
  add column if not exists link_clicks    bigint not null default 0;

-- record_read_pct: each reader contributes one sample of their max scroll
-- depth (clamped 1-100). Avg = sum / count, computed in the client.
create or replace function record_read_pct(p_article_id uuid, p_pct int)
returns void language plpgsql security definer as $$
begin
  if p_pct is null or p_pct < 1 or p_pct > 100 then return; end if;
  insert into article_engagement (article_id, read_pct_sum, read_pct_count, updated_at)
  values (p_article_id, p_pct, 1, now())
  on conflict (article_id)
  do update set
    read_pct_sum   = article_engagement.read_pct_sum   + p_pct,
    read_pct_count = article_engagement.read_pct_count + 1,
    updated_at     = now();
end;
$$;

create or replace function increment_link_click(p_article_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into article_engagement (article_id, link_clicks, updated_at)
  values (p_article_id, 1, now())
  on conflict (article_id)
  do update set link_clicks = article_engagement.link_clicks + 1, updated_at = now();
end;
$$;

-- 2. Story widget — editable singleton config row.
create table if not exists story_widget_config (
  id           text primary key default 'default',
  title        text    not null default 'Have a story to share?',
  prompt       text    not null default 'Tell us about your experience. Submissions are anonymous.',
  char_limit   int     not null default 500,
  button_label text    not null default 'Submit anonymously',
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

insert into story_widget_config (id) values ('default') on conflict do nothing;

alter table story_widget_config enable row level security;

create policy "Public read story config" on story_widget_config
  for select using (true);

create policy "Admin write story config" on story_widget_config
  for all using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  ) with check (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

-- 3. Story submissions — anonymous reader submissions.
create table if not exists story_submissions (
  id           uuid primary key default gen_random_uuid(),
  story        text not null,
  article_slug text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_story_submissions_created
  on story_submissions(created_at desc);

alter table story_submissions enable row level security;

create policy "Public submit story" on story_submissions
  for insert with check (length(story) between 1 and 2000);

create policy "Admin read story" on story_submissions
  for select using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

create policy "Admin delete story" on story_submissions
  for delete using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

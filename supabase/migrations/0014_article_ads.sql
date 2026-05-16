-- Article inline ad widgets — editable CTA blocks auto-injected into
-- article bodies. Each row configures one widget with its logo, headline,
-- bullet CTA links, and the heading position it lands before.

create table if not exists article_ads (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,                     -- internal label
  active          boolean not null default true,
  logo_url        text,
  logo_link       text,
  logo_alt        text,
  headline        text not null default '',
  eyebrow         text,                              -- small orange text
  bullets         jsonb not null default '[]'::jsonb, -- [{label,url}]
  position_heading integer not null default 3,       -- inject before nth h2/h3
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_article_ads_active on article_ads(active, display_order);

alter table article_ads enable row level security;

-- Public read so the static build can fetch ads without a service-role key.
create policy "Public read article_ads" on article_ads
  for select using (true);

create policy "Admin write article_ads" on article_ads
  for all using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  ) with check (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

-- Seed the PH1 ad that was previously hardcoded.
insert into article_ads (title, active, logo_url, logo_link, logo_alt, headline, eyebrow, bullets, position_heading, display_order)
values (
  'PH1 — AI Era Strategy',
  true,
  'https://github.com/arpyph1/my-assets/blob/main/ph1_logo-200-271.png?raw=true',
  'https://ph1.ca',
  'PH1 logo',
  'Ship products proven to deliver in the AI era',
  'Product Strategy consultancy founded in 2012',
  '[
    {"label": "Improve AI Product Success",          "url": "https://ph1.ca/improve-ai-performance"},
    {"label": "Accelerate Digital Transformation",   "url": "https://ph1.ca/accelerate-digital-transformation"},
    {"label": "Launch your first AI agent",          "url": "https://ph1.ca/ai-90-day-path-to-launch"}
  ]'::jsonb,
  3,
  0
);

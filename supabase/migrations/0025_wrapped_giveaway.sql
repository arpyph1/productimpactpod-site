-- /wrapped promo landing page: giveaway entry for one free seat in the
-- January Maven cohort, plus an optional "coffee chat" opt-in.
-- Same shape as survey_responses — anon insert, admin-only read/delete.

create table if not exists wrapped_entries (
  id                 uuid primary key default gen_random_uuid(),
  first_name         text not null,
  email              text not null,
  company            text not null,
  city               text not null,
  why_listen         text not null,
  wants_coffee_chat  boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists idx_wrapped_entries_created on wrapped_entries(created_at desc);

alter table wrapped_entries enable row level security;

-- Anonymous insert so the landing page form can submit without auth.
create policy "Public submit wrapped entries" on wrapped_entries
  for insert with check (true);

create policy "Admin read wrapped entries" on wrapped_entries
  for select using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

create policy "Admin delete wrapped entries" on wrapped_entries
  for delete using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

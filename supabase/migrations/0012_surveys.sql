-- Surveys: in-article interactive widget that admins/editors author and that
-- readers complete. Each survey has up to 10 questions plus a final "complete
-- screen" that captures the respondent's email and a consent checkbox.
--
-- questions  — JSONB array of { id, type, prompt, options? } items. Question
--              types: "single", "multi", "text", "rating" (1-5), "yesno".
-- complete   — JSONB { prompt, consent_label } describing the email screen.
-- responses  — one row per submission; answers JSONB mirrors question ids.

create table if not exists surveys (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  questions       jsonb not null default '[]'::jsonb,
  complete        jsonb not null default jsonb_build_object(
                    'prompt', 'Want a copy of the results? Leave your email.',
                    'consent_label', 'We will be contacting you to send you the information you''re requested.'
                  ),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      text
);

create index if not exists idx_surveys_created_at on surveys(created_at desc);

alter table surveys enable row level security;

-- Public reads so the widget can fetch survey config from the article page.
create policy "Public read surveys" on surveys
  for select using (true);

-- Admin write — gated by allowed-admin email check on the JWT.
create policy "Admin write surveys" on surveys
  for all using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  ) with check (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

create table if not exists survey_responses (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references surveys(id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb,
  email       text,
  consent     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_survey_responses_survey on survey_responses(survey_id);
create index if not exists idx_survey_responses_created on survey_responses(created_at desc);

alter table survey_responses enable row level security;

-- Anonymous insert so readers can submit. No public read of responses — only
-- the admin policy below grants visibility for editors in the admin UI.
create policy "Public submit responses" on survey_responses
  for insert with check (true);

create policy "Admin read responses" on survey_responses
  for select using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

create policy "Admin delete responses" on survey_responses
  for delete using (
    auth.jwt() ->> 'email' in ('arpy@ph1.ca','brittany@ph1.ca','info@productimpactpod.com')
    or split_part(auth.jwt() ->> 'email', '@', 2) in ('ph1.ca','productimpactpod.com')
  );

-- View used by the admin Surveys list to sort by response count without
-- N+1 queries from the client.
create or replace view surveys_with_counts as
  select
    s.*,
    coalesce(r.response_count, 0) as response_count,
    r.last_response_at
  from surveys s
  left join (
    select survey_id,
           count(*)::bigint as response_count,
           max(created_at)  as last_response_at
    from survey_responses
    group by survey_id
  ) r on r.survey_id = s.id;

grant select on surveys_with_counts to anon, authenticated;

-- Fix: surveys_with_counts was created with SECURITY DEFINER (Postgres/
-- Supabase default for views), which causes it to run as the view owner
-- and bypass RLS. Recreate it with SECURITY INVOKER so queries respect
-- the calling user's RLS policies on both underlying tables.

drop view if exists surveys_with_counts;

create view surveys_with_counts
  with (security_invoker = on)
as
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

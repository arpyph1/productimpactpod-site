-- Returns site-wide daily totals for a given event type so the admin
-- analytics "graph view" doesn't have to download every raw event row.
-- SECURITY DEFINER bypasses the hardcoded-email RLS policy on article_events.
create or replace function get_site_daily_stats(
  p_event_type text,
  p_from       timestamptz,
  p_to         timestamptz
)
returns table (day date, total numeric)
language sql
security definer
set search_path = public
as $$
  select
    (created_at at time zone 'UTC')::date as day,
    case
      when p_event_type = 'read_pct' then round(avg(amount)::numeric, 0)
      else sum(amount)::numeric
    end as total
  from article_events
  where event_type = p_event_type
    and created_at >= p_from
    and created_at <= p_to
  group by (created_at at time zone 'UTC')::date
  order by day;
$$;

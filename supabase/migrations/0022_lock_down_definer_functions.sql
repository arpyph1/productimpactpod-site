-- ═══════════════════════════════════════════════════════════════════════════
-- Lock down SECURITY DEFINER functions that were callable by anyone.
--
-- Postgres grants EXECUTE on functions to PUBLIC by default. Several of our
-- SECURITY DEFINER functions bypass RLS by design (that's the point), but they
-- had no caller-side guard — so any anonymous visitor holding the public anon
-- key could call them via PostgREST RPC:
--
--   • get_admin_users()      → leaked every admin/editor email + display name,
--                              bypassing the user_roles / profiles RLS.
--   • get_session_stats()    → leaked per-article session analytics.
--   • get_site_daily_stats() → leaked site-wide daily analytics.
--
-- This migration adds an in-function admin check AND revokes EXECUTE from
-- anon/public, leaving these callable only by authenticated admins. The public
-- engagement RPCs (increment_view, add_hearts, upsert_session, …) are
-- intentionally left open — they are how anonymous readers record analytics.
-- ═══════════════════════════════════════════════════════════════════════════

-- Shared admin predicate, mirroring the email/domain allowlist used by the
-- existing RLS policies. SECURITY DEFINER + stable so it can be reused.
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(public.has_role(auth.uid(), 'admin'), false)
    or coalesce(public.has_role(auth.uid(), 'editor'), false)
    or (auth.jwt() ->> 'email') in
         ('arpy@ph1.ca', 'brittany@ph1.ca', 'info@productimpactpod.com')
    or split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 2) in
         ('ph1.ca', 'productimpactpod.com');
$$;

revoke execute on function public.is_site_admin() from anon, public;
grant execute on function public.is_site_admin() to authenticated;

-- ── get_admin_users ──────────────────────────────────────────────────────────
create or replace function public.get_admin_users()
returns table (
  id           uuid,
  user_id      uuid,
  role         app_role,
  created_at   timestamptz,
  email        text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
    select
      r.id,
      r.user_id,
      r.role,
      r.created_at,
      coalesce(p.email, '(no profile)') as email,
      p.display_name
    from user_roles r
    left join profiles p on p.user_id = r.user_id
    order by r.created_at asc;
end;
$$;

revoke execute on function public.get_admin_users() from anon, public;
grant execute on function public.get_admin_users() to authenticated;

-- ── get_session_stats ────────────────────────────────────────────────────────
create or replace function public.get_session_stats()
returns table (
  landing_article_id uuid,
  avg_pages          numeric,
  session_count      bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
    select
      s.landing_article_id,
      round(avg(s.pages_count)::numeric, 1) as avg_pages,
      count(*)                              as session_count
    from article_sessions s
    where s.landing_article_id is not null
    group by s.landing_article_id;
end;
$$;

revoke execute on function public.get_session_stats() from anon, public;
grant execute on function public.get_session_stats() to authenticated;

-- ── get_site_daily_stats ─────────────────────────────────────────────────────
create or replace function public.get_site_daily_stats(
  p_event_type text,
  p_from       timestamptz,
  p_to         timestamptz
)
returns table (day date, total numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
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
end;
$$;

revoke execute on function public.get_site_daily_stats(text, timestamptz, timestamptz) from anon, public;
grant execute on function public.get_site_daily_stats(text, timestamptz, timestamptz) to authenticated;

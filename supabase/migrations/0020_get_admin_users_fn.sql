-- Returns all admin/editor users with their profile data.
-- SECURITY DEFINER so the join across user_roles → profiles works
-- regardless of the caller's RLS context.
create or replace function get_admin_users()
returns table (
  id          uuid,
  user_id     uuid,
  role        app_role,
  created_at  timestamptz,
  email       text,
  display_name text
)
language sql
security definer
set search_path = public
as $$
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
$$;

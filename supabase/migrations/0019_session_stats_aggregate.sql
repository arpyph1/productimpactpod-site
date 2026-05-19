-- Returns per-article session aggregates so the admin analytics screen
-- doesn't have to download every raw session row and compute averages
-- in the browser.
create or replace function get_session_stats()
returns table (
  landing_article_id  uuid,
  avg_pages           numeric,
  session_count       bigint
)
language sql
security definer
set search_path = public
as $$
  select
    landing_article_id,
    round(avg(pages_count)::numeric, 1) as avg_pages,
    count(*)                            as session_count
  from article_sessions
  where landing_article_id is not null
  group by landing_article_id;
$$;

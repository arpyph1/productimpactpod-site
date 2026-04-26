-- Scheduled publishing: add scheduled_at column and auto-publish function.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_articles_scheduled
  ON public.articles(scheduled_at)
  WHERE scheduled_at IS NOT NULL AND published = false;

-- Auto-publish articles whose scheduled_at has passed.
-- Called by the scheduled-rebuild workflow before triggering the site build.
CREATE OR REPLACE FUNCTION publish_scheduled_articles()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.articles
  SET published = true, scheduled_at = NULL, updated_at = now()
  WHERE scheduled_at IS NOT NULL
    AND scheduled_at <= now()
    AND published = false;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

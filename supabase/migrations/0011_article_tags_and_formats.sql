-- Tags + multi-format support for articles.
--
-- tags    — AI-generated, fine-grained labels (≥16 per article) used for
--           the /tags index and on-site search. Not displayed on the
--           article template; surfaced via meta keywords + JSON-LD.
-- formats — multi-valued category set (e.g. an article can be both a
--           feature AND a release-note). The legacy single-value `format`
--           column stays as the primary/canonical category for back-compat
--           and is mirrored as formats[0].

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS tags    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS formats text[] NOT NULL DEFAULT '{}';

-- Backfill formats from the existing single-value format column so existing
-- rows show up on multi-format listings without a re-save.
UPDATE public.articles
SET formats = ARRAY[format]
WHERE format IS NOT NULL
  AND (formats IS NULL OR cardinality(formats) = 0);

CREATE INDEX IF NOT EXISTS idx_articles_tags    ON public.articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_articles_formats ON public.articles USING GIN(formats);

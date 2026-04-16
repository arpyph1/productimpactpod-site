-- ═══════════════════════════════════════════════════════════════════════════
-- Product Impact — site bootstrap
--
-- Run AFTER 0001_initial_schema.sql completes successfully.
-- Idempotent: safe to re-run.
--
-- Creates the article-heroes Storage bucket (for AI-generated hero images),
-- seeds the two host entity rows, and ensures site-side anon reads work.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Storage bucket for AI-generated hero images ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-heroes',
  'article-heroes',
  true,
  10485760,                                     -- 10 MB per file
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- Anon-read policy on the bucket objects (the bucket is public, but an
-- explicit policy is required on the objects table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'article-heroes public read'
  ) THEN
    CREATE POLICY "article-heroes public read"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'article-heroes');
  END IF;
END $$;

-- ── Host entity rows ────────────────────────────────────────────────────────
-- /people/arpy-dragffy and /people/brittany-hobbs become real pages once
-- these exist. The Astro build reads from public.entities via the anon key.
INSERT INTO public.entities (type, slug, name, description, external_links, canonical_url)
VALUES
  ('person', 'arpy-dragffy', 'Arpy Dragffy',
   'Founder of PH1 Research and AI Value Acceleration. Co-host and producer of Product Impact Podcast.',
   '[
      {"label":"PH1 Research","url":"https://ph1.ca"},
      {"label":"AI Value Acceleration","url":"https://aivalueacceleration.com"},
      {"label":"LinkedIn","url":"https://linkedin.com/in/arpydragffy"}
    ]'::jsonb,
   'https://productimpactpod.com/people/arpy-dragffy'),

  ('person', 'brittany-hobbs', 'Brittany Hobbs',
   'Product leader at the intersection of AI capabilities, product strategy, and go-to-market. Co-host of Product Impact Podcast.',
   '[{"label":"LinkedIn","url":"https://linkedin.com/in/brittanyhobbs"}]'::jsonb,
   'https://productimpactpod.com/people/brittany-hobbs')
ON CONFLICT (type, slug) DO UPDATE SET
  name           = EXCLUDED.name,
  description    = EXCLUDED.description,
  external_links = EXCLUDED.external_links,
  canonical_url  = EXCLUDED.canonical_url;

-- ── Add anon SELECT policies to all public-facing tables ────────────────────
-- The initial schema's policies default to `public` role (which includes anon).
-- This block ensures anon specifically is covered in case a future schema
-- change tightens the role to `authenticated` only.
DO $$
BEGIN
  -- articles: anon can read published rows
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='articles' AND policyname='Anon read published articles') THEN
    CREATE POLICY "Anon read published articles" ON public.articles
      FOR SELECT TO anon USING (published = true);
  END IF;

  -- entities
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='entities' AND policyname='Anon read entities') THEN
    CREATE POLICY "Anon read entities" ON public.entities
      FOR SELECT TO anon USING (true);
  END IF;

  -- article_entities
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='article_entities' AND policyname='Anon read article_entities') THEN
    CREATE POLICY "Anon read article_entities" ON public.article_entities
      FOR SELECT TO anon USING (true);
  END IF;

  -- themes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='themes' AND policyname='Anon read themes') THEN
    CREATE POLICY "Anon read themes" ON public.themes
      FOR SELECT TO anon USING (true);
  END IF;

  -- lenses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='lenses' AND policyname='Anon read lenses') THEN
    CREATE POLICY "Anon read lenses" ON public.lenses
      FOR SELECT TO anon USING (true);
  END IF;

  -- episode_shownotes: anon can read published episodes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='episode_shownotes' AND policyname='Anon read published shownotes') THEN
    CREATE POLICY "Anon read published shownotes" ON public.episode_shownotes
      FOR SELECT TO anon USING (published = true);
  END IF;
END $$;

-- ── Summary ─────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM storage.buckets WHERE id = 'article-heroes') AS bucket_exists,
  (SELECT COUNT(*) FROM public.entities WHERE type='person' AND slug IN ('arpy-dragffy', 'brittany-hobbs')) AS host_rows,
  (SELECT COUNT(*) FROM public.themes) AS theme_count,
  (SELECT COUNT(*) FROM public.lenses) AS lens_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'Anon read %') AS anon_policies;

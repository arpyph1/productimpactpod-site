-- display_ads and house_ad contain only ad content (images, URLs, copy) —
-- no credentials or secrets. Add them to the public-read allowlist so the
-- client-side ad script on the homepage can fetch them with the anon key.

DROP POLICY IF EXISTS "Public read safe settings" ON public.site_settings;

CREATE POLICY "Public read safe settings" ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (key IN (
    'homepage',
    'seo',
    'social_drafts',
    'footer',
    'nav_items',
    'social_links',
    'podcast',
    'site_name',
    'site_tagline',
    'site_config',
    'custom_css',
    'custom_head',
    'hero_prompts',
    'display_ads',
    'house_ad'
  ));

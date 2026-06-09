-- hero_prompts contains only editorial style instructions (not credentials or
-- secrets), so it can be read by anyone. Adding it to the public-read allowlist
-- lets generate_hero_image.py fetch it using the anon key that is already
-- available in the environment, without requiring the service role key.

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
    'hero_prompts'
  ));

-- Allow anonymous reads of the display_ads site_settings key so the
-- client-side ad slot script can fetch active ads without authentication.

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
    'display_ads'
  ));

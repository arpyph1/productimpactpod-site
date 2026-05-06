-- Expand the public-read allowlist on site_settings so build-time anon
-- reads can hydrate the static site. Migration 0008 only allowed
-- 'homepage', 'seo', 'social_drafts', 'footer' — every other public key
-- (nav_items, social_links, podcast, etc.) was returning null at build
-- time, causing Nav/Footer/Podcast to silently fall back to defaults.
--
-- Sensitive keys (deploy_hook, hero_prompts, social_prompts, *_api)
-- remain admin-only via the existing "Admin read all settings" policy.

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
    'custom_head'
  ));

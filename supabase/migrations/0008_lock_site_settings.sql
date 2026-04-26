-- Restrict site_settings so anonymous users can only read non-sensitive keys.
-- Sensitive keys (API tokens, deploy hooks) require authenticated admin.

DROP POLICY IF EXISTS "Public can read settings" ON public.site_settings;

-- Public keys readable by anyone (homepage config, SEO, social drafts)
CREATE POLICY "Public read safe settings" ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (key IN ('homepage', 'seo', 'social_drafts', 'footer'));

-- Admin-only read for sensitive keys (instagram_api, deploy hooks, etc.)
CREATE POLICY "Admin read all settings" ON public.site_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

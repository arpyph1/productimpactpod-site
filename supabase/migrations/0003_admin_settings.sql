-- ═══════════════════════════════════════════════════════════════════════════
-- Admin panel additions
-- Run in Supabase SQL Editor after 0002.
-- ═══════════════════════════════════════════════════════════════════════════

-- Site settings key-value store
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update auto-admin to include brittany@ph1.ca
CREATE OR REPLACE FUNCTION public.auto_assign_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IN ('arpy@ph1.ca', 'brittany@ph1.ca', 'info@productimpactpod.com')
     OR NEW.email LIKE '%@ph1.ca'
     OR NEW.email LIKE '%@productimpactpod.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

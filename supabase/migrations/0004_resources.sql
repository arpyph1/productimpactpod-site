-- ═══════════════════════════════════════════════════════════════════════════
-- Resources table + storage bucket
-- Run in Supabase SQL Editor after 0003.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL DEFAULT 'report',
  color TEXT DEFAULT '#ff6b4a',
  pdf_url TEXT,
  pdf_filename TEXT,
  cover_image_url TEXT,
  blog_content_html TEXT DEFAULT '',
  blog_content_markdown TEXT DEFAULT '',
  themes TEXT[] DEFAULT '{}',
  published BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  download_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published resources" ON public.resources
  FOR SELECT TO anon, authenticated USING (published = true);
CREATE POLICY "Admins can manage resources" ON public.resources
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_resources_published ON public.resources (published, display_order);

-- Storage bucket for resource PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Public can read resource files" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'resources');
CREATE POLICY "Admins can upload resource files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'resources' AND public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Admins can delete resource files" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'resources' AND public.has_role(auth.uid(), 'admin')
  );

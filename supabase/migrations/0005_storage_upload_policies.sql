-- Add upload/update/delete policies for article-heroes storage bucket.
-- The bucket was created in 0002 with only a read policy, so admin users
-- couldn't upload images from the CMS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can upload article images'
  ) THEN
    CREATE POLICY "Admins can upload article images" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'article-heroes' AND public.has_role(auth.uid(), 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can update article images'
  ) THEN
    CREATE POLICY "Admins can update article images" ON storage.objects
      FOR UPDATE TO authenticated USING (
        bucket_id = 'article-heroes' AND public.has_role(auth.uid(), 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can delete article images'
  ) THEN
    CREATE POLICY "Admins can delete article images" ON storage.objects
      FOR DELETE TO authenticated USING (
        bucket_id = 'article-heroes' AND public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

-- Rewrite inline image URLs in article content_html to use CDN proxy.
-- Catches images pasted into the editor that reference Supabase Storage directly.

UPDATE public.articles
SET content_html = replace(
  content_html,
  'https://pgsljoqwfhufubodlqjk.supabase.co/storage/v1/object/public/',
  '/cdn/'
)
WHERE content_html LIKE '%pgsljoqwfhufubodlqjk.supabase.co/storage/v1/object/public/%';

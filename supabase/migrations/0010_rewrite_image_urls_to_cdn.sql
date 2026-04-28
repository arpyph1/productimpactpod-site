-- Rewrite existing hero_image_url values to use the Cloudflare CDN proxy.
-- Before: https://pgsljoqwfhufubodlqjk.supabase.co/storage/v1/object/public/article-heroes/...
-- After:  /cdn/article-heroes/...
-- This reduces Supabase Storage egress by serving images through Cloudflare's cache.

UPDATE public.articles
SET hero_image_url = '/cdn/' || split_part(hero_image_url, '/storage/v1/object/public/', 2)
WHERE hero_image_url LIKE '%supabase.co/storage/v1/object/public/%';

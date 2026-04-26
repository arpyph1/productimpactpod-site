-- Fix engagement security: remove overly permissive write policy,
-- validate hearts amount in RPC function.

-- Drop the wide-open write policy that allows direct REST manipulation
DROP POLICY IF EXISTS "Authenticated upsert engagement" ON article_engagement;

-- Replace add_hearts with amount validation (1-3 only)
CREATE OR REPLACE FUNCTION add_hearts(p_article_id uuid, p_amount int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_amount < 1 OR p_amount > 3 THEN
    RETURN;
  END IF;
  INSERT INTO article_engagement (article_id, hearts, updated_at)
  VALUES (p_article_id, p_amount, now())
  ON CONFLICT (article_id)
  DO UPDATE SET hearts = article_engagement.hearts + p_amount, updated_at = now();
END;
$$;

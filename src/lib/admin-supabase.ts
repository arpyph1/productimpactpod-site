import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );
  return _client;
}

const ALLOWED_ADMINS = ["arpy@ph1.ca", "brittany@ph1.ca", "info@productimpactpod.com"];

export function isAllowedAdmin(email: string | undefined): boolean {
  return !!email && ALLOWED_ADMINS.includes(email.toLowerCase());
}

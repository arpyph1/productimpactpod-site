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

const ALLOWED_EMAILS = ["arpy@ph1.ca", "brittany@ph1.ca", "info@productimpactpod.com"];
const ALLOWED_DOMAINS = ["ph1.ca", "productimpactpod.com"];

export function isAllowedAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ALLOWED_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1];
  return ALLOWED_DOMAINS.includes(domain);
}

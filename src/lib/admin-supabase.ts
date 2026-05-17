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

// TODO: Manage allowed admin emails/domains via the `admin_config` key in the
// Supabase `site_settings` table. Expected value shape:
//   { allowedEmails: string[], allowedDomains: string[] }
export async function isAllowedAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  try {
    const { data, error } = await getAdminClient()
      .from("site_settings")
      .select("value")
      .eq("key", "admin_config")
      .single();
    if (error || !data?.value) return false;
    const config = data.value as { allowedEmails?: string[]; allowedDomains?: string[] };
    const allowedEmails: string[] = config.allowedEmails ?? [];
    const allowedDomains: string[] = config.allowedDomains ?? [];
    const lower = email.toLowerCase();
    if (allowedEmails.includes(lower)) return true;
    const domain = lower.split("@")[1];
    return allowedDomains.includes(domain);
  } catch {
    return false;
  }
}

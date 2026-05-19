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

export async function isAllowedAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;
  const client = getAdminClient();

  const check = async (): Promise<boolean> => {
    try {
      // Primary check: user_roles table (managed via the Settings screen).
      // The "Users can read own role" RLS policy scopes this to the
      // currently-authenticated user's own rows automatically.
      const { data: roleData } = await client
        .from("user_roles")
        .select("role")
        .in("role", ["admin", "editor"])
        .limit(1);
      if (roleData && roleData.length > 0) return true;

      // Fallback: site_settings admin_config allowlist (email/domain based).
      const { data, error } = await client
        .from("site_settings")
        .select("value")
        .eq("key", "admin_config")
        .single();
      if (error || !data?.value) return false;
      const config = data.value as { allowedEmails?: string[]; allowedDomains?: string[] };
      const lower = email.toLowerCase();
      if ((config.allowedEmails ?? []).includes(lower)) return true;
      const domain = lower.split("@")[1];
      return (config.allowedDomains ?? []).includes(domain);
    } catch {
      return false;
    }
  };

  // Never hang the login flow — resolve false after 5 s if DB is unreachable.
  const deadline = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 5000));
  return Promise.race([check(), deadline]);
}

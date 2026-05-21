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

// ─── Admin verification cache ─────────────────────────────────────────────────
// Caches positive admin checks in localStorage so page refreshes don't require
// a DB round-trip. Only positive results are cached — a false could be a
// timeout, so we never cache "denied." 23-hour TTL means one DB check per day.

const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours

function cacheKey(email: string) {
  return `pi_admin_ok:${email.toLowerCase()}`;
}

function readCache(email: string): true | null {
  try {
    const raw = localStorage.getItem(cacheKey(email));
    if (!raw) return null;
    const { expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(cacheKey(email)); return null; }
    return true;
  } catch { return null; }
}

function writeCache(email: string) {
  try {
    localStorage.setItem(cacheKey(email), JSON.stringify({ expires: Date.now() + CACHE_TTL_MS }));
  } catch {}
}

export function clearAdminCache(email?: string) {
  try {
    if (email) {
      localStorage.removeItem(cacheKey(email));
    } else {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith("pi_admin_ok:")) localStorage.removeItem(k);
      }
    }
  } catch {}
}

// ─── isAllowedAdmin ───────────────────────────────────────────────────────────
export async function isAllowedAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;

  // Serve from cache — avoids a DB call on every page refresh and eliminates
  // the risk of a timeout false-negative logging the user out.
  if (readCache(email)) return true;

  const client = getAdminClient();

  const check = async (): Promise<boolean> => {
    try {
      // Primary: user_roles (managed via Settings screen).
      // "Users can read own role" RLS scopes this to the authenticated user.
      const { data: roleData } = await client
        .from("user_roles")
        .select("role")
        .in("role", ["admin", "editor"])
        .limit(1);
      if (roleData && roleData.length > 0) return true;

      // Fallback: site_settings admin_config email/domain allowlist.
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

  const deadline = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 8000));
  const allowed = await Promise.race([check(), deadline]);

  // Only cache a positive result — false could be a transient DB timeout.
  if (allowed) writeCache(email);

  return allowed;
}

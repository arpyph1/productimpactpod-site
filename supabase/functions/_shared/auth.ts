// Shared admin authorization for edge functions.
//
// These functions spend money (Anthropic API) or take privileged actions
// (triggering deploys via the service-role key), so they must NOT be callable
// with the public anon key that ships in the built site. We verify that the
// caller presents a real user session belonging to an admin/editor.
//
// The check mirrors the RLS policies in the migrations: a row in user_roles
// (admin|editor) wins; otherwise we fall back to the email/domain allowlist.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAILS = ["arpy@ph1.ca", "brittany@ph1.ca", "info@productimpactpod.com"];
const ADMIN_DOMAINS = ["ph1.ca", "productimpactpod.com"];

export type AdminCheck =
  | { ok: true; email: string }
  | { ok: false; status: number; error: string };

export async function verifyAdmin(req: Request): Promise<AdminCheck> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Missing authorization token" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 500, error: "Server auth not configured" };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate the token and resolve the user. The anon key is a JWT with no
  // user subject, so getUser() rejects it — exactly what we want.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }

  const user = userData.user;
  const email = (user.email ?? "").toLowerCase();

  // Primary: explicit admin/editor role.
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "editor"]);
  if (roles && roles.length > 0) return { ok: true, email };

  // Fallback: email / domain allowlist (mirrors the RLS policies).
  const domain = email.split("@")[1] ?? "";
  if (ADMIN_EMAILS.includes(email) || ADMIN_DOMAINS.includes(domain)) {
    return { ok: true, email };
  }

  return { ok: false, status: 403, error: "Admin access required" };
}

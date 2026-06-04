import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getStoredHookUrl(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "deploy_hook")
      .single();
    const url = data?.value?.url;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Gate: triggering a deploy uses the service-role key and burns build
  // minutes, so only authenticated admins/editors may call it.
  const auth = await verifyAdmin(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  try {
    // Primary: use the deploy hook URL stored in site_settings
    const storedHookUrl = await getStoredHookUrl();
    if (storedHookUrl) {
      const triggerRes = await fetch(storedHookUrl, { method: "POST" });
      const triggerText = await triggerRes.text();
      if (triggerRes.ok) {
        return jsonResponse({ success: true, message: "Build triggered via stored hook" });
      }
      return jsonResponse({
        error: `Deploy hook returned ${triggerRes.status}`,
        response: triggerText.slice(0, 500),
      }, 502);
    }

    // Fallback: use Cloudflare API to discover/create a deploy hook
    const cfApiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const cfProjectName = Deno.env.get("CLOUDFLARE_PROJECT_NAME") ?? "productimpactpod-site";

    if (!cfApiToken || !cfAccountId) {
      return jsonResponse({
        error: "No deploy hook URL configured in Settings, and Cloudflare API credentials are not set in Supabase secrets.",
        hint: "Go to Admin → Settings → Deploy Hook and paste your Cloudflare Pages deploy hook URL.",
      }, 500);
    }

    const cfBase = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${cfProjectName}`;
    const cfHeaders = { "Authorization": `Bearer ${cfApiToken}`, "Content-Type": "application/json" };

    const projRes = await fetch(cfBase, { headers: cfHeaders });
    const projData = await projRes.json();
    if (!projRes.ok) {
      return jsonResponse({
        error: "Cannot access Cloudflare project",
        status: projRes.status,
        details: projData.errors ?? projData.messages ?? projData,
        hint: `Check CLOUDFLARE_ACCOUNT_ID and project name "${cfProjectName}"`,
      }, 502);
    }

    const listRes = await fetch(`${cfBase}/deploy_hooks`, { headers: cfHeaders });
    const listData = await listRes.json();

    let hookUrl: string | null = null;

    if (listRes.ok && listData.result?.length > 0) {
      hookUrl = listData.result[0].hook_url;
    } else {
      const createRes = await fetch(`${cfBase}/deploy_hooks`, {
        method: "POST",
        headers: cfHeaders,
        body: JSON.stringify({ branch: "main" }),
      });
      const createData = await createRes.json();
      if (createRes.ok && createData.result?.hook_url) {
        hookUrl = createData.result.hook_url;
      } else {
        return jsonResponse({
          error: "Failed to create deploy hook",
          status: createRes.status,
          details: createData.errors ?? createData,
        }, 502);
      }
    }

    const triggerRes = await fetch(hookUrl!, { method: "POST" });
    const triggerText = await triggerRes.text();

    if (triggerRes.ok) {
      return jsonResponse({ success: true, message: "Build triggered via Cloudflare API" });
    }

    return jsonResponse({
      error: `Deploy hook returned ${triggerRes.status}`,
      response: triggerText.slice(0, 500),
    }, 502);
  } catch (err) {
    return jsonResponse({ error: "Deploy trigger failed", message: String(err) }, 500);
  }
});

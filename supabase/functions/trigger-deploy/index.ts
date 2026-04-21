import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cfApiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const cfAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const cfProjectName = Deno.env.get("CLOUDFLARE_PROJECT_NAME") ?? "productimpactpod-site";

  if (!cfApiToken) return jsonResponse({ error: "CLOUDFLARE_API_TOKEN not set in Supabase secrets" }, 500);
  if (!cfAccountId) return jsonResponse({ error: "CLOUDFLARE_ACCOUNT_ID not set in Supabase secrets" }, 500);

  const cfBase = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${cfProjectName}`;
  const cfHeaders = { "Authorization": `Bearer ${cfApiToken}`, "Content-Type": "application/json" };

  try {
    // Verify project exists
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

    // List existing deploy hooks
    const listRes = await fetch(`${cfBase}/deploy_hooks`, { headers: cfHeaders });
    const listData = await listRes.json();

    let hookUrl: string | null = null;

    if (listRes.ok && listData.result?.length > 0) {
      hookUrl = listData.result[0].hook_url;
    } else {
      // Create a deploy hook for main branch
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

    // Trigger the deploy hook
    const triggerRes = await fetch(hookUrl!, { method: "POST" });
    const triggerText = await triggerRes.text();

    if (triggerRes.ok) {
      return jsonResponse({ success: true, message: "Build triggered" });
    }

    return jsonResponse({
      error: `Deploy hook returned ${triggerRes.status}`,
      response: triggerText.slice(0, 500),
    }, 502);
  } catch (err) {
    return jsonResponse({ error: "Deploy trigger failed", message: String(err) }, 500);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cfApiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfAccountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const cfProjectName = Deno.env.get("CLOUDFLARE_PROJECT_NAME") ?? "productimpactpod-site";

    if (!cfApiToken || !cfAccountId) {
      return new Response(
        JSON.stringify({ error: "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfBase = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${cfProjectName}`;
    const cfHeaders = {
      "Authorization": `Bearer ${cfApiToken}`,
      "Content-Type": "application/json",
    };

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
        return new Response(
          JSON.stringify({ error: "Failed to create deploy hook", details: createData.errors ?? createData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Trigger the deploy hook
    const triggerRes = await fetch(hookUrl!, { method: "POST" });

    if (triggerRes.ok) {
      return new Response(
        JSON.stringify({ success: true, message: "Build triggered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Deploy hook returned ${triggerRes.status}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Deploy trigger failed", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

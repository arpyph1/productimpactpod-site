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

    const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${cfProjectName}/deployments`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (res.ok && data.success) {
      return new Response(
        JSON.stringify({ success: true, id: data.result?.id, url: data.result?.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Cloudflare API error", details: data.errors ?? data }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Deploy trigger failed", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

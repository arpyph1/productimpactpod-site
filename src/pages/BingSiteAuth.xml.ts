import { getSiteSetting } from "@lib/supabase";

export async function GET() {
  const seo = (await getSiteSetting("seo")) ?? {};
  const code = seo.bing_verification ?? "";
  const xml = `<?xml version="1.0"?>
<users>
  <user>${code}</user>
</users>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

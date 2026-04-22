import { getSiteSetting } from "@lib/supabase";

export async function GET() {
  const seo = (await getSiteSetting("seo")) ?? {};
  const key = seo.indexnow_key ?? "";
  return new Response(key, {
    headers: { "Content-Type": "text/plain" },
  });
}

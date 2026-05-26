interface Ctx { request: Request }

const SUBSTACK_URL = "https://productimpactpod.substack.com/api/v1/free";
const ALLOWED_ORIGIN = "https://productimpactpod.com";

function corsHeaders(origin: string) {
  const allowed = origin === ALLOWED_ORIGIN || origin === "http://localhost:4321";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function onRequestOptions({ request }: Ctx) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin") ?? "") });
}

export async function onRequestPost({ request }: Ctx) {
  const origin = request.headers.get("origin") ?? "";
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  let email: string;
  try {
    const body = await request.json() as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400, headers });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Please enter a valid email address." }), { status: 400, headers });
  }

  try {
    const res = await fetch(SUBSTACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": ALLOWED_ORIGIN,
      },
      body: JSON.stringify({ email, first_name: "", return_to: ALLOWED_ORIGIN }),
    });

    if (res.ok || res.status === 200) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    const text = await res.text().catch(() => "");
    console.error("Substack error", res.status, text);
    return new Response(JSON.stringify({ error: "Subscription failed. Please try again." }), { status: 502, headers });
  } catch (err) {
    console.error("Subscribe relay error", err);
    return new Response(JSON.stringify({ error: "Subscription failed. Please try again." }), { status: 500, headers });
  }
}

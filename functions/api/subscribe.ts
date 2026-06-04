import type { EventContext, KVNamespace } from "@cloudflare/workers-types";

const SUBSTACK_URL = "https://productimpactpod.substack.com/api/v1/free";
const ALLOWED_ORIGIN = "https://productimpactpod.com";

// Per-IP rate limit on the subscribe relay. Without this, the endpoint can be
// scripted to fire unlimited signups at our Substack (mailbombing third parties
// through our origin). Backed by an optional KV namespace binding named
// SUBSCRIBE_RL — bind it in Cloudflare Pages → Settings → Functions → KV
// namespace bindings. If the binding is absent the limiter fails open so the
// form keeps working, but production should configure it.
const RATE_LIMIT_MAX = 5; // submissions
const RATE_LIMIT_WINDOW_S = 600; // per 10 minutes

interface Env {
  SUBSCRIBE_RL?: KVNamespace;
}

async function isRateLimited(env: Env | undefined, ip: string): Promise<boolean> {
  const kv = env?.SUBSCRIBE_RL;
  if (!kv || !ip) return false; // fail open when unconfigured
  const key = `sub:${ip}`;
  const count = parseInt((await kv.get(key)) ?? "0", 10) || 0;
  if (count >= RATE_LIMIT_MAX) return true;
  await kv.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_S });
  return false;
}

function corsHeaders(origin: string) {
  const allowed = origin === ALLOWED_ORIGIN || origin === "http://localhost:4321";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function onRequestOptions({ request }: EventContext<Env, string, unknown>) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin") ?? "") });
}

export async function onRequestPost({ request, env }: EventContext<Env, string, unknown>) {
  const origin = request.headers.get("origin") ?? "";
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (await isRateLimited(env, ip)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again in a few minutes." }),
      { status: 429, headers },
    );
  }

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

    // Substack returns 200 even for existing subscribers, but handle other cases gracefully.
    const text = await res.text().catch(() => "");
    console.error("Substack error", res.status, text);
    return new Response(JSON.stringify({ error: "Subscription failed. Please try again." }), { status: 502, headers });
  } catch (err) {
    console.error("Subscribe relay error", err);
    return new Response(JSON.stringify({ error: "Subscription failed. Please try again." }), { status: 500, headers });
  }
}

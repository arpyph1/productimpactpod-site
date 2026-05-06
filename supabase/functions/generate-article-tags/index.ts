import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = [
  "https://productimpactpod.com",
  "https://www.productimpactpod.com",
  "http://localhost:4321",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const SYSTEM_PROMPT = `You generate fine-grained, search-optimized tags for product/AI news articles.

Rules:
- Return ONLY a JSON array of tag strings. No prose, no explanation, no markdown fences.
- Produce AT LEAST 20 tags so the editor can prune to 16+ usable ones.
- Each tag is a short kebab-case slug: lowercase, words separated by hyphens, no punctuation, 1–4 words.
- Mix tag types: companies/products mentioned, people, technologies, concepts, industries, use-cases, geographies, regulatory frameworks, model names, feature categories.
- Prefer specific over generic: "agentic-coding" over "ai", "openai-o1" over "openai".
- Every tag must be directly grounded in the article — do not invent facts.
- No duplicates, no near-duplicates (e.g. don't return both "ai" and "artificial-intelligence").`;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { title, subtitle, content_html, themes } = await req.json();

    if (!title || !content_html) {
      return new Response(
        JSON.stringify({ error: "title and content_html are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const plainText = String(content_html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const truncated = plainText.length > 12000 ? plainText.slice(0, 12000) + "…" : plainText;

    const userMessage = [
      `Title: ${title}`,
      subtitle ? `Subtitle: ${subtitle}` : "",
      Array.isArray(themes) && themes.length ? `Themes: ${themes.join(", ")}` : "",
      "",
      `Article body:`,
      truncated,
    ].filter(Boolean).join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Anthropic API error:", JSON.stringify(errData));
      return new Response(
        JSON.stringify({ error: "AI generation failed", details: errData.error?.message || "Unknown error" }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim() || "[]";
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]");
    const jsonSlice = jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : "[]";

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSlice);
    } catch {
      console.error("Failed to parse tag JSON:", raw);
      return new Response(
        JSON.stringify({ error: "Model returned invalid JSON", raw }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const tags = Array.isArray(parsed)
      ? Array.from(new Set(
          parsed
            .filter((t): t is string => typeof t === "string")
            .map(slugify)
            .filter((t) => t.length >= 2 && t.length <= 60)
        ))
      : [];

    return new Response(
      JSON.stringify({ tags }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

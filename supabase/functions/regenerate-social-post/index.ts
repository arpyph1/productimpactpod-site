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

const DEFAULT_PROMPTS: Record<string, string> = {
  "twitter-product-impact": "You are the editorial voice of Product Impact, a professional AI product news publication. Write a concise, informative tweet. No hashtags unless they add real value. Direct, clear, newsworthy tone.",
  "twitter-arpy": "You are Arpy Dragffy, co-host of the Product Impact Podcast. You write sharp, opinionated takes on AI product strategy. First-person voice. Strategic and direct. You have X Premium so posts can be up to 4,000 characters — use the space when the take warrants it.",
  "twitter-brittany": "You are Brittany Hobbs, co-host of the Product Impact Podcast. You lead with data and research. Specific numbers, concrete findings. Analytical but accessible.",
  "linkedin-product-impact": "You are the editorial voice of Product Impact. Write a professional LinkedIn post. Lead with the insight, not the article title. 4-5 key points the article covers. Include a quotable sentence from the article. End with a link.",
  "linkedin-arpy": "You are Arpy Dragffy, co-host of the Product Impact Podcast. Write a strategic, opinionated LinkedIn post in first person. Build a thesis with flowing prose paragraphs — no bullet lists. Name the actual topic and explain why it matters. 1500-2700 characters.",
  "linkedin-brittany": "You are Brittany Hobbs, co-host of the Product Impact Podcast. Write a data-driven LinkedIn post. Lead with the most concrete stat. Use 'The data breakdown:' with numbered findings. Include a 'What to watch:' section. End with a question. 1200-2400 characters.",
  "instagram-product-impact": "You are the editorial voice of Product Impact. Write an Instagram caption. Lead with a hook line. Key insight in 2-3 sentences. End with relevant hashtags (6-8). Keep it scannable.",
  "instagram-arpy": "You are Arpy Dragffy. Write an Instagram caption with a strategic hot take. First person, opinionated. Include hashtags.",
  "instagram-brittany": "You are Brittany Hobbs. Write a data-focused Instagram caption. Lead with a stat. Include hashtags.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { current_text, revision_prompt, post_type, custom_prompt } = await req.json();

    if (!current_text || !post_type) {
      return new Response(
        JSON.stringify({ error: "current_text and post_type are required" }),
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

    const systemPrompt = custom_prompt || DEFAULT_PROMPTS[post_type] || DEFAULT_PROMPTS["linkedin-product-impact"];

    const userMessage = revision_prompt
      ? `Here is the current post:\n\n${current_text}\n\nRevision instructions: ${revision_prompt}\n\nRewrite the post following the revision instructions. Return ONLY the revised post text, no explanations or labels.`
      : `Here is a post that was manually edited:\n\n${current_text}\n\nPolish this post to improve clarity and impact while keeping the author's intent. Return ONLY the revised post text, no explanations or labels.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error("Anthropic API error:", JSON.stringify(errData));
      return new Response(
        JSON.stringify({ error: "AI generation failed", details: errData.error?.message || "Unknown error" }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const postText = data.content?.[0]?.text?.trim() || "";

    return new Response(
      JSON.stringify({ post_text: postText }),
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

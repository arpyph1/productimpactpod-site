const LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</.well-known/agent-skills/index.json>; rel="https://agentskills.io/rel/agent-skills-index"',
  '</.well-known/mcp/server-card.json>; rel="mcp-server-card"',
  '</rss.xml>; rel="alternate"; type="application/rss+xml"; title="Product Impact"',
  '</news/rss.xml>; rel="alternate"; type="application/rss+xml"; title="News"',
  '</podcast/rss.xml>; rel="alternate"; type="application/rss+xml"; title="Podcast"',
  '</sitemap.xml>; rel="sitemap"; type="application/xml"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
].join(", ");

export const onRequest: PagesFunction = async ({ request, next }) => {
  const response = await next();
  const contentType = response.headers.get("Content-Type") ?? "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  const accept = request.headers.get("Accept") ?? "";
  // Only treat as markdown request when text/markdown is listed and text/html is NOT preferred
  const wantsMarkdown =
    accept.includes("text/markdown") &&
    (!accept.includes("text/html") ||
      accept.indexOf("text/markdown") < accept.indexOf("text/html"));

  if (wantsMarkdown) {
    const html = await response.text();
    const markdown = htmlToMarkdown(html, request.url);
    const bytes = new TextEncoder().encode(markdown).length;
    return new Response(markdown, {
      status: response.status,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Link": LINK_HEADER,
        "Vary": "Accept",
        "X-Markdown-Tokens": String(Math.ceil(bytes / 4)),
        "Cache-Control": response.headers.get("Cache-Control") ?? "public, max-age=300",
      },
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Link", LINK_HEADER);
  const existing = headers.get("Vary");
  headers.set("Vary", existing ? `${existing}, Accept` : "Accept");

  return new Response(response.body, { status: response.status, headers });
};

// ── HTML → Markdown ────────────────────────────────────────────────────────

function htmlToMarkdown(html: string, pageUrl: string): string {
  const origin = new URL(pageUrl).origin;

  let s = html
    // Drop everything before/after <body>
    .replace(/[\s\S]*?<body[^>]*>/i, "")
    .replace(/<\/body>[\s\S]*/i, "")
    // Remove non-content blocks
    .replace(/<(script|style|nav|footer|header|aside|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, "")
    // Headings
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${"#".repeat(+n)} ${strip(t).trim()}\n\n`)
    // Links (resolve relative)
    .replace(/<a[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
      const label = strip(text).trim();
      const url = href.startsWith("/") ? origin + href : href;
      return label ? `[${label}](${url})` : url;
    })
    // Images
    .replace(/<img[^>]*\bsrc="([^"]*)"[^>]*\balt="([^"]*)"[^>]*>/gi, "![$2]($1)")
    .replace(/<img[^>]*\balt="([^"]*)"[^>]*\bsrc="([^"]*)"[^>]*>/gi, "![$1]($2)")
    // Inline formatting
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "_$2_")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    // Code blocks (before stripping)
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => `\`\`\`\n${strip(t).trim()}\n\`\`\`\n\n`)
    // Horizontal rule
    .replace(/<hr[^>]*>/gi, "\n---\n\n")
    // List items
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${strip(t).trim()}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    // Paragraphs & blocks
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${strip(t).trim()}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(div|section|article|main)[^>]*>/gi, "\n");

  // Strip remaining tags
  s = strip(s);

  // HTML entities
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/");

  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

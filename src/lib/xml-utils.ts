export const STRIP_HTML = /<[^>]*>/g;
export const STRIP_CDATA = /<!\[CDATA\[|\]\]>/g;
export const UNSAFE_TAGS = /<\/?(script|iframe|object|embed|form|input|style|meta|link|base)[^>]*>/gi;

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

export function extractTag(item: string, tag: string): string {
  const escaped = tag.replace(/:/g, "\\:");
  const re = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)</${escaped}>`, "i");
  const m = item.match(re);
  if (!m) return "";
  return m[1].replace(STRIP_CDATA, "").trim();
}

export function extractAttribute(item: string, tag: string, attr: string): string {
  const escaped = tag.replace(/:/g, "\\:");
  const re = new RegExp(`<${escaped}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m = item.match(re);
  return m ? m[1] : "";
}

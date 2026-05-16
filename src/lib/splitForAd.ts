// Split sanitized article HTML at the third heading (h2/h3) so the PH1
// sponsor block can be rendered between the two halves. If the article
// has fewer than three headings, the ad lands at the very end — every
// article still gets one impression.

export function splitForAd(html: string): { before: string; after: string } {
  // Match opening h2 or h3 tags (case-insensitive). We split BEFORE the
  // third match so the ad sits above the section it introduces.
  const re = /<h[23](\s[^>]*)?>/gi;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(html)) !== null) {
    count++;
    if (count === 3) {
      return {
        before: html.slice(0, m.index),
        after: html.slice(m.index),
      };
    }
  }
  // Fewer than three headings — drop the ad at the end.
  return { before: html, after: "" };
}

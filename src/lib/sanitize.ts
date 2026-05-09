import sanitize from "sanitize-html";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  "a", "strong", "em", "b", "i", "u", "s", "del",
  "blockquote", "code", "pre",
  "table", "thead", "tbody", "tr", "th", "td",
  "img", "figure", "figcaption",
  "div", "span", "sup", "sub", "mark",
  "iframe",
];

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "width", "height", "loading"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  iframe: [
    "src", "width", "height", "title",
    "frameborder", "allow", "allowfullscreen",
    "referrerpolicy", "loading",
  ],
  div: ["data-survey-id", "style"],
  "*": ["class", "id", "lang", "dir"],
};

export function sanitizeHtml(dirty: string): string {
  return sanitize(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto"],
    allowedIframeHostnames: [
      "www.youtube.com", "youtube.com", "youtube-nocookie.com",
      "player.vimeo.com",
      "open.spotify.com",
      "platform.twitter.com",
    ],
    disallowedTagsMode: "discard",
  });
}

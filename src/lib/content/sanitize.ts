import sanitizeHtml from "sanitize-html";

// Keep useful formatting (lists, tables, code, images, emphasis, colors)
// while removing scripts, event handlers and other unsafe content.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "a", "b", "i", "u", "s", "em", "strong", "mark", "small", "sub", "sup", "del", "ins",
    "br", "hr", "p", "div", "span", "blockquote", "font",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "dl", "dt", "dd",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    "pre", "code", "kbd", "samp", "var",
    "img", "figure", "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    font: ["color"],
    td: ["colspan", "rowspan", "align"],
    th: ["colspan", "rowspan", "align", "scope"],
    ol: ["start", "type"],
    code: ["class"],
    pre: ["class"],
    "*": ["style", "class"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      "font-weight": [/^(bold|normal|[1-9]00)$/],
      "font-style": [/^(italic|normal)$/],
      "text-decoration": [/^[a-z\s-]+$/i],
      "text-align": [/^(left|right|center|justify)$/],
      "font-family": [/^[\w\s,"'-]+$/],
    },
  },
  allowedClasses: { "*": [/^[\w-]+$/] },
  allowedSchemes: ["http", "https", "mailto", "data"],
  allowedSchemesByTag: { img: ["http", "https", "data"], a: ["http", "https", "mailto"] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

export function sanitizeCardHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS).trim();
}

/** Plain text used for searching and duplicate detection. */
export function htmlToPlainText(html: string): string {
  const withImages = (html ?? "").replace(/<img[^>]*src=["']?([^"' >]+)[^>]*>/gi, " [img:$1] ");
  const text = sanitizeHtml(withImages.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr)>/gi, "\n"), {
    allowedTags: [],
    allowedAttributes: {},
  });
  return decodeEntities(text);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

export function normalizeForHash(html: string): string {
  return htmlToPlainText(html).toLowerCase().replace(/\s+/g, " ").trim();
}

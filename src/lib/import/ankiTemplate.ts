// Minimal Anki card-template renderer, so imported cards look the way they do
// in Anki instead of being raw note fields. Supports:
//   {{Field}}, {{filter:Field}} (text, cloze, hint, type, furigana…),
//   {{#Field}}…{{/Field}}, {{^Field}}…{{/Field}}, {{FrontSide}}, {{Tags}}, {{Deck}}…
//   cloze deletions (one card per cloze number) and Image Occlusion
//   (both the legacy "Image Occlusion Enhanced" add-on and Anki's built-in type).

export type AnkiNotetype = {
  name: string;
  kind: "normal" | "cloze";
  fields: string[];
  templates: { name: string; qfmt: string; afmt: string }[];
};

export type RenderContext = { tags: string; deck: string; ord: number };

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
}

function isEmptyField(html: string | undefined) {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  return stripHtml(html).trim() === "";
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CLOZE_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

/** Cloze numbers used in a field (1-based), e.g. [1, 2, 3]. */
export function clozeNumbers(html: string): number[] {
  const out = new Set<number>();
  for (const m of html.matchAll(CLOZE_RE)) out.add(Number(m[1]));
  return [...out].sort((a, b) => a - b);
}

export function renderCloze(html: string, active: number, side: "q" | "a"): string {
  return html.replace(CLOZE_RE, (_m, n: string, answer: string, hint?: string) => {
    if (Number(n) !== active) return answer;
    if (side === "a") return `<span class="cloze">${answer}</span>`;
    return `<span class="cloze">[${hint ? escapeHtml(hint) : "…"}]</span>`;
  });
}

// ── Image Occlusion (Anki ≥ 23.10 built-in) ──────────────────────────────────

type IoShape = { ord: number; kind: string; props: Record<string, string> };

function parseIoShapes(occlusion: string): IoShape[] {
  const shapes: IoShape[] = [];
  for (const m of occlusion.matchAll(CLOZE_RE)) {
    const body = m[2];
    if (!body.startsWith("image-occlusion:")) continue;
    const [, kind, ...rest] = body.split(":");
    const props: Record<string, string> = {};
    for (const kv of rest) {
      const i = kv.indexOf("=");
      if (i > 0) props[kv.slice(0, i)] = kv.slice(i + 1);
    }
    shapes.push({ ord: Number(m[1]), kind, props });
  }
  return shapes;
}

const pct = (v: string | undefined) => `${(Math.max(0, Math.min(1, Number(v) || 0)) * 100).toFixed(3)}%`;

function ioShapeHtml(s: IoShape, cls: string): string | null {
  const p = s.props;
  const vals = ["left", "top", "width", "height", "rx", "ry"].map((k) => Number(p[k] ?? 0));
  if (vals.some((v) => v > 1.0001)) return null; // legacy pixel coordinates — unsupported
  if (s.kind === "rect") {
    return `<div class="io-shape ${cls}" style="left:${pct(p.left)};top:${pct(p.top)};width:${pct(p.width)};height:${pct(p.height)}"></div>`;
  }
  if (s.kind === "ellipse") {
    const w = p.width ?? String(Number(p.rx ?? 0) * 2);
    const h = p.height ?? String(Number(p.ry ?? 0) * 2);
    return `<div class="io-shape io-ellipse ${cls}" style="left:${pct(p.left)};top:${pct(p.top)};width:${pct(w)};height:${pct(h)}"></div>`;
  }
  if (s.kind === "polygon" && p.points) {
    const pts = p.points.trim().split(/\s+/).map((xy) => xy.split(",").map(Number));
    if (pts.some(([x, y]) => !(x <= 1.0001 && y <= 1.0001))) return null;
    const poly = pts.map(([x, y]) => `${(x * 100).toFixed(3)}% ${(y * 100).toFixed(3)}%`).join(", ");
    return `<div class="io-shape ${cls}" style="left:0%;top:0%;width:100%;height:100%;clip-path:polygon(${poly})"></div>`;
  }
  return null;
}

function renderBuiltinImageOcclusion(f: Record<string, string>, ord: number) {
  const shapes = parseIoShapes(f["Occlusion"] ?? "");
  const active = ord + 1;
  const build = (side: "q" | "a") => {
    const parts: string[] = [];
    for (const s of shapes) {
      const isActive = s.ord === active;
      const occludeInactive = s.props.oi === "1";
      if (!isActive && !occludeInactive) continue;
      const cls = isActive ? (side === "q" ? "io-active" : "io-revealed") : "io-inactive";
      const html = ioShapeHtml(s, cls);
      if (html) parts.push(html);
    }
    return `<div class="io-container">${f["Image"] ?? ""}${parts.join("")}</div>`;
  };
  const header = isEmptyField(f["Header"]) ? "" : `<div class="io-header">${f["Header"]}</div>`;
  const extra = ["Back Extra", "Comments"].map((k) => f[k]).filter((v) => !isEmptyField(v)).join("<br>");
  return {
    front: header + build("q"),
    back: build("a") + (extra ? `<div class="io-extra">${extra}</div>` : ""),
  };
}

// ── Generic template rendering ───────────────────────────────────────────────

function applyFilters(name: string, fields: Record<string, string>, ctx: RenderContext, side: "q" | "a"): string {
  const parts = name.split(":").map((s) => s.trim());
  const fieldName = parts.pop()!;
  const filters = parts;
  let value: string;
  switch (fieldName) {
    case "Tags":
      value = escapeHtml(ctx.tags.trim());
      break;
    case "Deck":
      value = escapeHtml(ctx.deck);
      break;
    case "Subdeck":
      value = escapeHtml(ctx.deck.split("::").pop() ?? "");
      break;
    case "Card":
    case "Type":
    case "CardFlag":
      value = "";
      break;
    default:
      value = fields[fieldName] ?? "";
  }
  for (const f of filters.reverse()) {
    if (f === "type" || f.startsWith("tts")) return "";
    if (f === "cloze") value = renderCloze(value, ctx.ord + 1, side);
    else if (f === "text") value = escapeHtml(stripHtml(value));
    // hint, furigana, kana, kanji, … → show the field as is
  }
  return value;
}

function renderSections(tpl: string, fields: Record<string, string>): string {
  let prev: string;
  let out = tpl;
  do {
    prev = out;
    out = out.replace(/\{\{([#^])\s*([^}]+?)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g, (_m, kind: string, name: string, inner: string) => {
      const fieldName = name.split(":").pop()!.trim();
      const empty = isEmptyField(fields[fieldName]);
      return (kind === "#") !== empty ? inner : "";
    });
  } while (out !== prev);
  return out;
}

function renderTemplate(tpl: string, fields: Record<string, string>, ctx: RenderContext, side: "q" | "a", frontSide = "") {
  const withSections = renderSections(tpl, fields);
  return withSections.replace(/\{\{\s*([^#^/{}][^{}]*?)\s*\}\}/g, (_m, name: string) =>
    name === "FrontSide" ? frontSide : applyFilters(name, fields, ctx, side),
  );
}

function cleanup(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/^\s*(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, "")
    .trim();
}

/** Render one Anki card (note + template ordinal) into front/back HTML. */
export function renderAnkiCard(nt: AnkiNotetype, values: string[], ctx: RenderContext): { front: string; back: string } {
  const fields: Record<string, string> = {};
  nt.fields.forEach((name, i) => (fields[name] = values[i] ?? ""));

  if (fields["Occlusion"] !== undefined && fields["Image"] !== undefined && /image-occlusion:/.test(fields["Occlusion"])) {
    return renderBuiltinImageOcclusion(fields, ctx.ord);
  }

  const tpl = nt.kind === "cloze" ? nt.templates[0] : nt.templates[ctx.ord];
  if (!tpl) return { front: values[0] ?? "", back: values[1] ?? "" };
  const front = cleanup(renderTemplate(tpl.qfmt, fields, ctx, "q"));
  // The back normally repeats the front via {{FrontSide}}; our study screen
  // already shows the front, so render it empty and drop the divider.
  let back = renderTemplate(tpl.afmt, fields, ctx, "a", "");
  back = cleanup(back.replace(/^\s*<hr\b[^>]*id=["']?answer["']?[^>]*>/i, ""));
  return { front, back };
}

/** Anki card ordinals that a note produces. */
export function cardOrdinals(nt: AnkiNotetype, values: string[]): number[] {
  if (nt.kind === "cloze") {
    const nums = new Set<number>();
    nt.fields.forEach((_, i) => clozeNumbers(values[i] ?? "").forEach((n) => nums.add(n)));
    return [...nums].sort((a, b) => a - b).map((n) => n - 1);
  }
  return nt.templates.map((_, i) => i);
}

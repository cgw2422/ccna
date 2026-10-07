// Turns stored (sanitized) card HTML into display HTML:
//  - plain-text cards keep their line breaks
//  - ```fenced``` blocks and `inline code` become code
//  - lines that look like Cisco IOS CLI commands get monospace styling
//  - relative <img src="x.png"> resolve to the media route
//  - Anki [sound:] tags are dropped; cloze deletions are rendered

const HAS_HTML = /<\/?[a-z][\s\S]*?>/i;

const CLI_PROMPT = /^[A-Za-z][\w.-]{0,30}(\((?:config|cfg)[\w-]*\))?[#>]\s?\S/;
const CLI_COMMAND =
  /^(?:show|sh|conf(?:igure)?\s+t(?:erminal)?|interface|int|ip|ipv6|no|router|network|switchport|hostname|enable|line\s+(?:vty|con)|login|transport|username|spanning-tree|vlan|copy|ping|traceroute|tracert|access-list|standby|vrrp|glbp|channel-group|service|banner|crypto|clock|ntp|logging|snmp-server|end|exit|write|wr|reload|debug|undebug|passive-interface|default-information|redistribute|encapsulation|duplex|speed|shutdown|description|mac\s+address-table|arp|cdp|lldp|errdisable|password|exec-timeout|auto-cost|maximum-paths|distance|neighbor|area|license|boot|dir|delete|erase|do)\b[\w\s./:\-|,()*!#"'?+=<>]*$/i;

export function looksLikeCli(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 120) return false;
  if (CLI_PROMPT.test(t)) return true;
  if (!CLI_COMMAND.test(t)) return false;
  // Avoid flagging prose: CLI lines are short, lowercase-ish and have no sentence punctuation.
  const words = t.split(/\s+/);
  if (words.length > 10) return false;
  if (/[.?]$/.test(t) && !/\d\.$/.test(t)) return false;
  if (/^[A-Z][a-z]+\s+[a-z]+\s+[a-z]+\s+[a-z]+/.test(t) && !/^(Router|Switch)/.test(t)) return false;
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function plainTextToHtml(text: string): string {
  const out: string[] = [];
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      const lines = parts[i].split(/\r?\n/);
      const rendered = lines.map((line) => {
        if (looksLikeCli(line)) return `<code class="cli">${escapeHtml(line.trim())}</code>`;
        return escapeHtml(line).replace(/`([^`\n]+)`/g, (_, c) => `<code>${c}</code>`);
      });
      out.push(rendered.join("<br>"));
    } else if (i % 3 === 2) {
      out.push(`<pre><code>${escapeHtml(parts[i].replace(/\n$/, ""))}</code></pre>`);
    }
  }
  return out.join("");
}

const BLOCK_BOUNDARY = /^<\/?(br|div|p|li|td|th|tr|ul|ol|table|tbody|blockquote|h[1-6])\b[^>]*>$/i;

function markCliLinesInHtml(html: string): string {
  const tokens = html.split(/(<[^>]+>)/g);
  let inPre = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok) continue;
    if (tok.startsWith("<")) {
      if (/^<(pre|code)\b/i.test(tok)) inPre++;
      else if (/^<\/(pre|code)>/i.test(tok)) inPre = Math.max(0, inPre - 1);
      continue;
    }
    if (inPre) continue;
    const prev = findNeighbourTag(tokens, i, -1);
    const next = findNeighbourTag(tokens, i, 1);
    const prevOk = prev === null || BLOCK_BOUNDARY.test(prev);
    const nextOk = next === null || BLOCK_BOUNDARY.test(next);
    const text = tok.replace(/&nbsp;/g, " ").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    if (prevOk && nextOk && looksLikeCli(text)) {
      tokens[i] = `<code class="cli">${escapeHtml(text.trim())}</code>`;
    }
  }
  return tokens.join("");
}

function findNeighbourTag(tokens: string[], i: number, dir: 1 | -1): string | null {
  for (let j = i + dir; j >= 0 && j < tokens.length; j += dir) {
    const t = tokens[j];
    if (!t) continue;
    if (t.startsWith("<")) return t;
    if (t.trim()) return "<text>";
  }
  return null;
}

function resolveMedia(html: string): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc=)(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (full, pre: string, dq?: string, sq?: string, bare?: string) => {
      const src = (dq ?? sq ?? bare ?? "").trim();
      if (!src || /^(https?:|data:|\/)/i.test(src)) return full;
      return `${pre}"/api/media/f/${encodeURIComponent(decodeURIComponentSafe(src))}" loading="lazy"`;
    },
  );
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const CLOZE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

export function renderCloze(html: string, side: "front" | "back"): string {
  return html.replace(CLOZE, (_m, _n, answer: string, hint?: string) =>
    side === "front"
      ? `<span class="cloze">[${hint ? escapeHtml(hint) : "…"}]</span>`
      : `<span class="cloze">${answer}</span>`,
  );
}

export function formatCardHtml(stored: string, side: "front" | "back" = "front"): string {
  let html = (stored ?? "").replace(/\[sound:[^\]]+\]/g, "");
  html = renderCloze(html, side);
  html = HAS_HTML.test(html) ? markCliLinesInHtml(html) : plainTextToHtml(html);
  return resolveMedia(html);
}

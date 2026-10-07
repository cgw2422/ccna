// Jeremy's IT Lab study-day detection from tags / deck names.
//
// Recognizes Day1, Day01, Day_1, Day-1, day1, "Day 1", "Day 01 - Network
// Devices", hierarchical tags like CCNA::Day_05 or JITL::Day05::VLANs, etc.

const DAY_RE = /(?:^|[^a-z0-9])day[\s_\-.:#]*0*(\d{1,3})(?![0-9])/i;

export function detectDayNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = DAY_RE.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 365 ? n : null;
}

/** Normalize a day label to the canonical "Day N" form. */
export function normalizeDayLabel(text: string): string | null {
  const n = detectDayNumber(text);
  return n == null ? null : `Day ${n}`;
}

/** Split an Anki-style tag string ("Day_01 CCNA::OSI   foo") into tags. */
export function splitTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const parts = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

/**
 * Pick a study day for a card. Tags win over the deck name; if tags reference
 * several different days the lowest is used (cards are usually tagged with
 * the day they were introduced).
 */
export function detectDayForCard(tags: string[], deckName?: string | null, explicitDay?: string | null): number | null {
  if (explicitDay) {
    const fromExplicit = /^\s*\d{1,3}\s*$/.test(explicitDay) ? Number(explicitDay) : detectDayNumber(explicitDay);
    if (fromExplicit && fromExplicit >= 1) return fromExplicit;
  }
  const fromTags = tags.map(detectDayNumber).filter((n): n is number => n != null);
  if (fromTags.length) return Math.min(...fromTags);
  return detectDayNumber(deckName ?? null);
}

/** Try to pull a topic title out of a deck/tag name, e.g. "CCNA::Day 05 - Ethernet LAN Switching". */
export function detectDayTitle(text: string | null | undefined): string | null {
  if (!text) return null;
  const segments = text.split("::");
  for (const seg of segments.reverse()) {
    const m = /day[\s_\-.:#]*0*\d{1,3}\s*[-–—:|.]\s*(.+)$/i.exec(seg.trim());
    if (m) {
      const title = m[1].replace(/_/g, " ").trim();
      if (title.length >= 2 && title.length <= 80) return title;
    }
  }
  return null;
}

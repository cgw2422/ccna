export const IMPORT_FIELDS = ["front", "back", "tags", "extra", "deck", "day", "sourceId"] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  front: "Question (Front)",
  back: "Answer (Back)",
  tags: "Tags",
  extra: "Extra / Notes",
  deck: "Anki deck name",
  day: "Study day",
  sourceId: "Source ID (Anki GUID)",
};

/** Column index for each target field, or -1 for none. */
export type ImportMapping = Record<ImportField, number>;

export type ParsedTable = {
  columns: string[];
  rows: string[][];
  suggested: ImportMapping;
  fieldsAreHtml: boolean;
  notes: string[];
};

export type MappedRow = Partial<Record<ImportField, string>>;

export type DuplicateMode = "update" | "new" | "skip";

export type ImportOptions = {
  source: string;
  duplicateMode: DuplicateMode;
  fieldsAreHtml: boolean;
  removeDemo: boolean;
};

export type ChunkResult = { created: number; duplicates: number; updated: number; errors: number; unassigned: number; daysCreated: number };

export function emptyMapping(): ImportMapping {
  return { front: -1, back: -1, tags: -1, extra: -1, deck: -1, day: -1, sourceId: -1 };
}

const HEADER_HINTS: Record<ImportField, RegExp> = {
  front: /^(front|question|q|prompt|term|text)$/i,
  back: /^(back|answer|a|definition|response)$/i,
  tags: /^tags?$/i,
  extra: /^(extra|notes?|back extra|explanation|comments?)$/i,
  deck: /^deck$/i,
  day: /^(day|study ?day|lesson)$/i,
  sourceId: /^(guid|id|note ?id|source ?id|uuid)$/i,
};

export function suggestMapping(columns: string[], base: Partial<ImportMapping> = {}): ImportMapping {
  const m = { ...emptyMapping(), ...base };
  columns.forEach((c, i) => {
    for (const f of Object.keys(HEADER_HINTS) as ImportField[]) {
      if (m[f] === -1 && HEADER_HINTS[f].test(c.trim())) {
        m[f] = i;
        break;
      }
    }
  });
  // Fall back to the first two unassigned columns for front/back.
  const used = new Set(Object.values(m).filter((v) => v >= 0));
  const free = columns.map((_, i) => i).filter((i) => !used.has(i));
  if (m.front === -1 && free.length) m.front = free.shift()!;
  if (m.back === -1 && free.length) m.back = free.shift()!;
  return m;
}

export function applyMapping(row: string[], mapping: ImportMapping): MappedRow {
  const out: MappedRow = {};
  for (const [field, idx] of Object.entries(mapping) as [ImportField, number][]) {
    if (idx >= 0 && idx < row.length) out[field] = row[idx];
  }
  return out;
}

import "server-only";
import path from "node:path";
import { unzipSync } from "fflate";
import { decompress as zstdDecompress } from "fzstd";
import initSqlJs, { type Database } from "sql.js";
import type { ParsedTable } from "./types";
import { renderAnkiCard, type AnkiNotetype } from "./ankiTemplate";

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstd(b: Uint8Array) {
  return b.length > 4 && ZSTD_MAGIC.every((v, i) => b[i] === v);
}

function maybeDecompress(b: Uint8Array) {
  return isZstd(b) ? zstdDecompress(b) : b;
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;
function getSql() {
  sqlPromise ??= initSqlJs({ locateFile: (f) => path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules", "sql.js", "dist", f) });
  return sqlPromise;
}

function all<T = Record<string, unknown>>(db: Database, sql: string): T[] {
  const res = db.exec(sql);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])) as T);
}

function hasTable(db: Database, name: string) {
  return all(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`).length > 0;
}

// ── Minimal protobuf reader for the modern media map ──────────────────────────
function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0, shift = 0, b: number;
  do {
    b = buf[pos++];
    result += (b & 0x7f) * 2 ** shift;
    shift += 7;
  } while (b & 0x80);
  return [result, pos];
}

function* protoFields(buf: Uint8Array): Generator<{ field: number; wire: number; value: Uint8Array | number }> {
  let pos = 0;
  while (pos < buf.length) {
    let key: number;
    [key, pos] = readVarint(buf, pos);
    const field = Math.floor(key / 8), wire = key & 7;
    if (wire === 0) {
      let v: number;
      [v, pos] = readVarint(buf, pos);
      yield { field, wire, value: v };
    } else if (wire === 2) {
      let len: number;
      [len, pos] = readVarint(buf, pos);
      yield { field, wire, value: buf.subarray(pos, pos + len) };
      pos += len;
    } else if (wire === 5) pos += 4;
    else if (wire === 1) pos += 8;
    else break;
  }
}

/** Map of zip entry name ("0", "1", …) → original media filename. */
function readMediaMap(raw: Uint8Array | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw?.length) return out;
  const data = maybeDecompress(raw);
  const text = new TextDecoder().decode(data.subarray(0, 1));
  if (text === "{") {
    const json = JSON.parse(new TextDecoder().decode(data)) as Record<string, string>;
    for (const [k, v] of Object.entries(json)) out.set(k, v);
    return out;
  }
  // MediaEntries { repeated MediaEntry entries = 1; } MediaEntry { string name = 1; ... legacy_zip_filename = 255 }
  let index = 0;
  for (const f of protoFields(data)) {
    if (f.field !== 1 || !(f.value instanceof Uint8Array)) continue;
    let name = "", legacy: number | null = null;
    for (const sub of protoFields(f.value)) {
      if (sub.field === 1 && sub.value instanceof Uint8Array) name = new TextDecoder().decode(sub.value);
      if (sub.field === 255 && typeof sub.value === "number") legacy = sub.value;
    }
    out.set(String(legacy ?? index), name);
    index++;
  }
  return out;
}

export type ApkgResult = ParsedTable & { media: { filename: string; data: Uint8Array }[]; noteCount: number };

function protoString(buf: Uint8Array, field: number): string {
  for (const f of protoFields(buf)) if (f.field === field && f.value instanceof Uint8Array) return new TextDecoder().decode(f.value);
  return "";
}

function protoVarint(buf: Uint8Array, field: number): number {
  for (const f of protoFields(buf)) if (f.field === field && typeof f.value === "number") return f.value;
  return 0;
}

function loadNotetypes(db: Database): Map<string, AnkiNotetype> {
  const out = new Map<string, AnkiNotetype>();
  if (hasTable(db, "notetypes") && hasTable(db, "fields") && hasTable(db, "templates")) {
    for (const r of all<{ id: number; name: string; config: Uint8Array }>(db, "SELECT id, name, config FROM notetypes")) {
      out.set(String(r.id), {
        name: r.name,
        kind: r.config && protoVarint(r.config, 1) === 1 ? "cloze" : "normal",
        fields: [],
        templates: [],
      });
    }
    for (const r of all<{ ntid: number; name: string }>(db, "SELECT ntid, name FROM fields ORDER BY ntid, ord")) out.get(String(r.ntid))?.fields.push(r.name);
    for (const r of all<{ ntid: number; name: string; config: Uint8Array }>(db, "SELECT ntid, name, config FROM templates ORDER BY ntid, ord")) {
      out.get(String(r.ntid))?.templates.push({ name: r.name, qfmt: protoString(r.config, 1), afmt: protoString(r.config, 2) });
    }
    return out;
  }
  const col = all<{ models: string }>(db, "SELECT models FROM col")[0];
  const models = JSON.parse(col?.models || "{}") as Record<
    string,
    { name: string; type?: number; flds: { name: string; ord: number }[]; tmpls: { name: string; ord: number; qfmt: string; afmt: string }[] }
  >;
  for (const [id, m] of Object.entries(models)) {
    out.set(id, {
      name: m.name,
      kind: m.type === 1 ? "cloze" : "normal",
      fields: [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name),
      templates: [...(m.tmpls ?? [])].sort((a, b) => a.ord - b.ord).map((t) => ({ name: t.name, qfmt: t.qfmt, afmt: t.afmt })),
    });
  }
  return out;
}

export const APKG_COLUMNS = ["Front", "Back", "Tags", "Deck", "Card ID", "Note type"] as const;

export async function parseApkg(buffer: Uint8Array): Promise<ApkgResult> {
  const files = unzipSync(buffer);
  const dbBytes = files["collection.anki21b"]
    ? zstdDecompress(files["collection.anki21b"])
    : files["collection.anki21"] ?? files["collection.anki2"];
  if (!dbBytes) throw new Error("This doesn't look like an Anki package (no collection found).");

  const SQL = await getSql();
  const db = new SQL.Database(dbBytes);
  try {
    const notetypes = loadNotetypes(db);

    const deckNames = new Map<string, string>();
    if (hasTable(db, "decks")) {
      for (const r of all<{ id: number; name: string }>(db, "SELECT id, name FROM decks")) deckNames.set(String(r.id), r.name.replace(/\x1f/g, "::"));
    } else {
      const col = all<{ decks: string }>(db, "SELECT decks FROM col")[0];
      const decks = JSON.parse(col?.decks || "{}") as Record<string, { name: string }>;
      for (const [id, d] of Object.entries(decks)) deckNames.set(id, d.name);
    }

    const notes = new Map<string, { guid: string; mid: number; flds: string; tags: string }>();
    for (const n of all<{ id: number; guid: string; mid: number; flds: string; tags: string }>(db, "SELECT id, guid, mid, flds, tags FROM notes")) {
      notes.set(String(n.id), n);
    }
    // One row per real Anki card (a cloze note with c1..c3 → three cards).
    const cards = all<{ nid: number; did: number; ord: number }>(db, "SELECT nid, did, ord FROM cards ORDER BY nid, ord");

    const rows: string[][] = [];
    const typeCounts = new Map<string, number>();
    for (const c of cards) {
      const note = notes.get(String(c.nid));
      if (!note) continue;
      const nt = notetypes.get(String(note.mid));
      const values = note.flds.split("\x1f");
      const deck = deckNames.get(String(c.did)) ?? "";
      const tags = note.tags.trim();
      const { front, back } = nt
        ? renderAnkiCard(nt, values, { tags, deck, ord: c.ord })
        : { front: values[0] ?? "", back: values[1] ?? "" };
      // Keep the plain GUID for the first card so re-imports match older imports.
      const cardId = c.ord === 0 ? note.guid : `${note.guid}#${c.ord}`;
      const typeName = nt?.name ?? "";
      typeCounts.set(typeName, (typeCounts.get(typeName) ?? 0) + 1);
      rows.push([front, back, tags, deck, cardId, typeName]);
    }

    const mediaMap = readMediaMap(files["media"]);
    const media: { filename: string; data: Uint8Array }[] = [];
    for (const [entry, filename] of mediaMap) {
      const data = files[entry];
      if (data && filename) media.push({ filename, data: maybeDecompress(data) });
    }

    const notesOut = [`Anki package: ${notes.size} notes → ${rows.length} cards, ${media.length} media files.`];
    const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n || "unknown"} (${c})`);
    if (types.length) notesOut.push(`Note types: ${types.join(", ")}. Cards are rendered with the deck's own templates.`);
    if (files["collection.anki21b"]) notesOut.push("Modern Anki format (2.1.50+) detected.");
    return {
      columns: [...APKG_COLUMNS],
      rows,
      suggested: { front: 0, back: 1, tags: 2, deck: 3, sourceId: 4, extra: -1, day: -1 },
      fieldsAreHtml: true,
      notes: notesOut,
      media,
      noteCount: notes.size,
    };
  } finally {
    db.close();
  }
}

import "server-only";
import path from "node:path";
import { unzipSync } from "fflate";
import { decompress as zstdDecompress } from "fzstd";
import initSqlJs, { type Database } from "sql.js";
import { suggestMapping, type ParsedTable } from "./types";

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

export async function parseApkg(buffer: Uint8Array): Promise<ApkgResult> {
  const files = unzipSync(buffer);
  const dbBytes = files["collection.anki21b"]
    ? zstdDecompress(files["collection.anki21b"])
    : files["collection.anki21"] ?? files["collection.anki2"];
  if (!dbBytes) throw new Error("This doesn't look like an Anki package (no collection found).");

  const SQL = await getSql();
  const db = new SQL.Database(dbBytes);
  try {
    // Note types → field names
    const fieldNames = new Map<string, string[]>();
    const notetypeNames = new Map<string, string>();
    if (hasTable(db, "fields") && hasTable(db, "notetypes")) {
      for (const r of all<{ ntid: number; ord: number; name: string }>(db, "SELECT ntid, ord, name FROM fields ORDER BY ntid, ord")) {
        const k = String(r.ntid);
        fieldNames.set(k, [...(fieldNames.get(k) ?? []), r.name]);
      }
      for (const r of all<{ id: number; name: string }>(db, "SELECT id, name FROM notetypes")) notetypeNames.set(String(r.id), r.name);
    } else {
      const col = all<{ models: string }>(db, "SELECT models FROM col")[0];
      const models = JSON.parse(col?.models || "{}") as Record<string, { name: string; flds: { name: string; ord: number }[] }>;
      for (const [id, m] of Object.entries(models)) {
        fieldNames.set(id, [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name));
        notetypeNames.set(id, m.name);
      }
    }

    // Decks
    const deckNames = new Map<string, string>();
    if (hasTable(db, "decks")) {
      for (const r of all<{ id: number; name: string }>(db, "SELECT id, name FROM decks")) deckNames.set(String(r.id), r.name.replace(/\x1f/g, "::"));
    } else {
      const col = all<{ decks: string }>(db, "SELECT decks FROM col")[0];
      const decks = JSON.parse(col?.decks || "{}") as Record<string, { name: string }>;
      for (const [id, d] of Object.entries(decks)) deckNames.set(id, d.name);
    }
    const noteDeck = new Map<string, string>();
    for (const r of all<{ nid: number; did: number }>(db, "SELECT nid, MIN(did) AS did FROM cards GROUP BY nid")) noteDeck.set(String(r.nid), String(r.did));

    const notes = all<{ id: number; guid: string; mid: number; flds: string; tags: string }>(db, "SELECT id, guid, mid, flds, tags FROM notes ORDER BY id");

    // Columns: fields of the most common note type, padded to the widest note.
    const midCounts = new Map<string, number>();
    let width = 0;
    for (const n of notes) {
      midCounts.set(String(n.mid), (midCounts.get(String(n.mid)) ?? 0) + 1);
      width = Math.max(width, n.flds.split("\x1f").length);
    }
    const mainMid = [...midCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const names = fieldNames.get(mainMid ?? "") ?? [];
    const fieldCols = Array.from({ length: width }, (_, i) => names[i] ?? `Field ${i + 1}`);
    const columns = [...fieldCols, "Tags", "Deck", "GUID", "Note type"];

    const rows = notes.map((n) => {
      const flds = n.flds.split("\x1f");
      while (flds.length < width) flds.push("");
      return [...flds, n.tags.trim(), deckNames.get(noteDeck.get(String(n.id)) ?? "") ?? "", n.guid, notetypeNames.get(String(n.mid)) ?? ""];
    });

    // Media
    const mediaMap = readMediaMap(files["media"]);
    const media: { filename: string; data: Uint8Array }[] = [];
    for (const [entry, filename] of mediaMap) {
      const data = files[entry];
      if (data && filename) media.push({ filename, data: maybeDecompress(data) });
    }

    const base = suggestMapping(fieldCols);
    const suggested = { ...base, tags: width, deck: width + 1, sourceId: width + 2 };
    const notesOut = [`Anki package: ${notes.length} notes, ${media.length} media files.`];
    if (files["collection.anki21b"]) notesOut.push("Modern Anki format (2.1.50+) detected.");
    return { columns, rows, suggested, fieldsAreHtml: true, notes: notesOut, media, noteCount: notes.length };
  } finally {
    db.close();
  }
}

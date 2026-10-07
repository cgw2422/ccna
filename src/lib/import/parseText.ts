import Papa from "papaparse";
import { emptyMapping, suggestMapping, type ImportMapping, type ParsedTable } from "./types";

const SEPARATORS: Record<string, string> = { tab: "\t", comma: ",", semicolon: ";", pipe: "|", space: " ", colon: ":" };

/**
 * Parse CSV/TSV text, including Anki "Notes in Plain Text" exports which start
 * with header lines like:
 *   #separator:tab  #html:true  #guid column:1  #tags column:5  #deck column:3
 */
export function parseDelimitedText(text: string, fileName = ""): ParsedTable {
  const notes: string[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  let delimiter: string | undefined;
  let fieldsAreHtml = true;
  let explicitColumns: string[] | null = null;
  const anki: Partial<ImportMapping> = {};
  let headerLines = 0;
  for (const line of lines) {
    const m = /^#([a-z ]+):(.*)$/i.exec(line);
    if (!m) break;
    headerLines++;
    const key = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (key === "separator") delimiter = SEPARATORS[value.toLowerCase()] ?? value;
    else if (key === "html") fieldsAreHtml = value.toLowerCase() === "true";
    else if (key === "columns") explicitColumns = value.split(delimiter ?? "\t");
    else if (key === "tags column") anki.tags = Number(value) - 1;
    else if (key === "guid column") anki.sourceId = Number(value) - 1;
    else if (key === "deck column") anki.deck = Number(value) - 1;
    else if (key === "notetype column") {
      /* ignored */
    }
  }
  if (headerLines) notes.push("Detected Anki plain-text export headers.");
  const body = lines.slice(headerLines).join("\n");
  if (!delimiter) {
    if (/\.tsv$|\.txt$/i.test(fileName)) delimiter = "\t";
    else if (/\.csv$/i.test(fileName)) delimiter = undefined; // let papaparse guess , or ;
  }
  const result = Papa.parse<string[]>(body, {
    delimiter: delimiter ?? "",
    skipEmptyLines: "greedy",
    quoteChar: '"',
  });
  if (result.errors.length) {
    const fatal = result.errors.filter((e) => e.type !== "FieldMismatch");
    if (fatal.length) notes.push(`${fatal.length} parse warning(s), e.g. row ${fatal[0].row}: ${fatal[0].message}`);
  }
  let rows = result.data.filter((r) => r.some((c) => c.trim() !== ""));
  const width = Math.max(0, ...rows.map((r) => r.length));

  let columns: string[];
  if (explicitColumns) {
    columns = explicitColumns.map((c, i) => c.trim() || `Column ${i + 1}`);
  } else if (rows.length && looksLikeHeader(rows[0])) {
    columns = rows[0].map((c, i) => c.trim() || `Column ${i + 1}`);
    rows = rows.slice(1);
    notes.push("First row used as column names.");
  } else {
    columns = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  }
  while (columns.length < width) columns.push(`Column ${columns.length + 1}`);

  // Anki exports often put tags last without a header; spot space-separated Day tags.
  if (anki.tags === undefined) {
    const sample = rows.slice(0, 50);
    for (let i = columns.length - 1; i >= 0; i--) {
      if (sample.length && sample.filter((r) => /(^|\s)day[\s_\-.]*\d/i.test(r[i] ?? "")).length >= sample.length * 0.5) {
        anki.tags = i;
        break;
      }
    }
  }
  const suggested = suggestMapping(columns, anki);
  return { columns, rows, suggested, fieldsAreHtml, notes };
}

function looksLikeHeader(row: string[]): boolean {
  const known = /^(front|back|question|answer|tags?|extra|notes?|deck|day|guid|id|text|term|definition)$/i;
  return row.filter((c) => known.test(c.trim())).length >= Math.min(2, row.length);
}

export { emptyMapping };

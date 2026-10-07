"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { parseDelimitedText } from "@/lib/import/parseText";
import { detectDayForCard, splitTags } from "@/lib/import/dayDetect";
import {
  applyMapping,
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  type ChunkResult,
  type DuplicateMode,
  type ImportField,
  type ImportMapping,
  type ParsedTable,
} from "@/lib/import/types";

type Step = "pick" | "map" | "importing" | "done";
const CHUNK = 400;

type Summary = ChunkResult & { total: number; demoRemoved: number };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function ImportWizard({ demoCount }: { demoCount: number }) {
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [apkgBatch, setApkgBatch] = useState<{ id: string; media: number } | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [source, setSource] = useState("Jeremy's IT Lab");
  const [fieldsAreHtml, setFieldsAreHtml] = useState(true);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("update");
  const [removeDemo, setRemoveDemo] = useState(demoCount > 0);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    setError(null);
    setFile(f);
    setLoading(true);
    try {
      if (/\.apkg$|\.colpkg$/i.test(f.name)) {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/import/apkg", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        setApkgBatch({ id: data.batchId, media: data.mediaCount });
        setTable(data.table);
        setMapping(data.table.suggested);
        setFieldsAreHtml(true);
      } else {
        const text = await f.text();
        const t = parseDelimitedText(text, f.name);
        if (!t.rows.length) throw new Error("No rows found in this file.");
        setTable(t);
        setMapping(t.suggested);
        setFieldsAreHtml(t.fieldsAreHtml);
      }
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read file");
    } finally {
      setLoading(false);
    }
  }

  const dayPreview = useMemo(() => {
    if (!table || !mapping) return null;
    const counts = new Map<number | null, number>();
    for (const row of table.rows) {
      const m = applyMapping(row, mapping);
      const day = detectDayForCard(splitTags(m.tags), m.deck, m.day);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const days = [...counts.entries()].filter(([d]) => d != null).sort((a, b) => a[0]! - b[0]!);
    return { days: days as [number, number][], unassigned: counts.get(null) ?? 0 };
  }, [table, mapping]);

  async function runImport() {
    if (!table || !mapping || !file) return;
    setError(null);
    setStep("importing");
    setProgress(0);
    try {
      const format = apkgBatch ? "apkg" : /\.csv$/i.test(file.name) ? "csv" : "tsv";
      const { id } = await postJson<{ id: string }>("/api/import/batches", {
        batchId: apkgBatch?.id,
        fileName: file.name,
        format,
        mapping,
        options: { source, duplicateMode, fieldsAreHtml, removeDemo },
      });
      const totals: ChunkResult = { created: 0, duplicates: 0, updated: 0, errors: 0, unassigned: 0, daysCreated: 0 };
      for (let i = 0; i < table.rows.length; i += CHUNK) {
        const rows = table.rows.slice(i, i + CHUNK).map((r) => applyMapping(r, mapping));
        const r = await postJson<ChunkResult>(`/api/import/batches/${id}/rows`, { startIndex: i, rows });
        for (const k of Object.keys(totals) as (keyof ChunkResult)[]) totals[k] += r[k];
        setProgress(Math.min(100, Math.round(((i + rows.length) / table.rows.length) * 100)));
      }
      const fin = await postJson<{ demoRemoved: number }>(`/api/import/batches/${id}/finalize`, {});
      setSummary({ ...totals, total: table.rows.length, demoRemoved: fin.demoRemoved });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setStep("map");
    }
  }

  if (step === "pick") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="panel flex w-full flex-col items-center gap-3 border-2 border-dashed px-6 py-10 text-center"
        >
          {loading ? <Loader2 className="size-10 animate-spin text-primary" /> : <FileUp className="size-10 text-primary" />}
          <span className="text-lg font-semibold">{loading ? "Reading file…" : "Choose a file"}</span>
          <span className="text-sm text-muted">CSV · TSV · Anki “Notes in Plain Text” (.txt) · Anki package (.apkg)</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.apkg,.colpkg,text/csv,text/tab-separated-values,text/plain"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        {error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}
        <section className="panel p-4 text-sm">
          <h2 className="mb-2 font-bold">Exporting from Anki</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted">
            <li>In Anki desktop: <b className="text-text">File → Export…</b></li>
            <li>
              Choose <b className="text-text">Notes in Plain Text (.txt)</b> and tick <i>Include HTML and media references</i>,{" "}
              <i>Include tags</i>, <i>Include deck name</i> and <i>Include unique identifier</i>.
            </li>
            <li>Or choose <b className="text-text">Anki Deck Package (.apkg)</b> to bring images along too.</li>
          </ol>
          <p className="mt-3 text-muted">
            Cards are sorted into study days from tags like <code className="rounded bg-surface-2 px-1">Day_01</code>, <code className="rounded bg-surface-2 px-1">Day1</code> or{" "}
            <code className="rounded bg-surface-2 px-1">Day-1</code>, or from deck names like “Day 01 – Network Devices”. Re-importing the same file won&apos;t create duplicates.
          </p>
        </section>
      </div>
    );
  }

  if (step === "map" && table && mapping) {
    const preview = table.rows.slice(0, 3).map((r) => applyMapping(r, mapping));
    return (
      <div className="space-y-4">
        <section className="panel p-4">
          <p className="font-semibold">{file?.name}</p>
          <p className="text-sm text-muted">
            {table.rows.length.toLocaleString()} rows · {table.columns.length} columns
            {apkgBatch && ` · ${apkgBatch.media} images stored`}
          </p>
          {table.notes.map((n) => (
            <p key={n} className="mt-1 text-xs text-muted">{n}</p>
          ))}
        </section>

        <section>
          <p className="section-title">Map columns</p>
          <div className="panel divide-y divide-border">
            {IMPORT_FIELDS.map((f: ImportField) => (
              <div key={f} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                <label htmlFor={`map-${f}`} className="text-sm font-medium">
                  {IMPORT_FIELD_LABELS[f]}
                  {f === "front" && <span className="text-danger"> *</span>}
                </label>
                <select
                  id={`map-${f}`}
                  className="input w-44 text-sm"
                  value={mapping[f]}
                  onChange={(e) => setMapping({ ...mapping, [f]: Number(e.target.value) })}
                >
                  <option value={-1}>— none —</option>
                  {table.columns.map((c, i) => (
                    <option key={i} value={i}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="section-title">Preview</p>
          <div className="space-y-2">
            {preview.map((r, i) => (
              <div key={i} className="panel p-3 text-sm">
                <p className="line-clamp-2 font-medium">{stripHtml(r.front ?? "") || <span className="text-danger">(empty front)</span>}</p>
                <p className="mt-1 line-clamp-2 text-muted">{stripHtml(r.back ?? "")}</p>
                <p className="mt-1.5 text-xs font-semibold text-primary">
                  {(() => {
                    const d = detectDayForCard(splitTags(r.tags), r.deck, r.day);
                    return d ? `→ Day ${d}` : "→ Unassigned";
                  })()}
                  {r.tags && <span className="ml-2 font-normal text-muted">{r.tags.slice(0, 80)}</span>}
                </p>
              </div>
            ))}
          </div>
        </section>

        {dayPreview && (
          <section className="panel p-4">
            <p className="font-semibold">Study day detection</p>
            <p className="mt-1 text-sm text-muted">
              {dayPreview.days.length} days detected · {dayPreview.unassigned.toLocaleString()} cards unassigned
            </p>
            {dayPreview.days.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {dayPreview.days.map(([d, n]) => (
                  <span key={d} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium tabular-nums">
                    Day {d}: {n}
                  </span>
                ))}
              </div>
            )}
            {dayPreview.unassigned > 0 && (
              <p className="mt-3 text-xs text-muted">Unassigned cards can be assigned later from the Study Plan → Unassigned.</p>
            )}
          </section>
        )}

        <section>
          <p className="section-title">Options</p>
          <div className="panel divide-y divide-border">
            <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <label htmlFor="source" className="text-sm font-medium">Source</label>
              <input id="source" className="input w-44 text-sm" value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
            <label className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <span className="text-sm font-medium">Fields contain HTML</span>
              <input type="checkbox" checked={fieldsAreHtml} onChange={(e) => setFieldsAreHtml(e.target.checked)} className="size-5 accent-[var(--primary)]" />
            </label>
            <div className="px-4 py-3">
              <p className="text-sm font-medium">Same question, different answer</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
                {(
                  [
                    ["update", "Update"],
                    ["new", "Add new"],
                    ["skip", "Skip"],
                  ] as [DuplicateMode, string][]
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDuplicateMode(v)}
                    className={`min-h-10 rounded-lg text-sm font-semibold ${duplicateMode === v ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">Exact duplicates are always skipped. Updating keeps your review progress.</p>
            </div>
            {demoCount > 0 && (
              <label className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                <span>
                  <span className="block text-sm font-medium">Remove demo cards</span>
                  <span className="block text-xs text-muted">{demoCount} sample cards created at sign-up</span>
                </span>
                <input type="checkbox" checked={removeDemo} onChange={(e) => setRemoveDemo(e.target.checked)} className="size-5 accent-[var(--primary)]" />
              </label>
            )}
          </div>
        </section>

        {error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}
        <div className="grid grid-cols-3 gap-2">
          <button className="btn btn-secondary" onClick={() => { setStep("pick"); setTable(null); setApkgBatch(null); }}>Back</button>
          <button className="btn btn-primary col-span-2" disabled={mapping.front < 0} onClick={runImport}>
            Import {table.rows.length.toLocaleString()} cards
          </button>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="panel flex flex-col items-center p-8 text-center">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="mt-4 text-lg font-semibold">Importing… {progress}%</p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-sm text-muted">Keep this screen open until it finishes.</p>
      </div>
    );
  }

  if (step === "done" && summary) {
    return (
      <div className="space-y-4">
        <div className="panel flex flex-col items-center p-6 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <p className="mt-3 text-xl font-bold">Import complete</p>
          <p className="text-sm text-muted">{summary.total.toLocaleString()} rows processed</p>
        </div>
        <div className="panel divide-y divide-border">
          <SummaryRow label="New cards" value={summary.created} tone="text-success" />
          <SummaryRow label="Duplicates skipped" value={summary.duplicates} />
          <SummaryRow label="Updated" value={summary.updated} tone="text-primary" />
          <SummaryRow label="New study days" value={summary.daysCreated} />
          <SummaryRow label="Unassigned (no day found)" value={summary.unassigned} tone={summary.unassigned ? "text-warning" : undefined} />
          {summary.errors > 0 && <SummaryRow label="Skipped (empty rows)" value={summary.errors} tone="text-danger" />}
          {summary.demoRemoved > 0 && <SummaryRow label="Demo cards removed" value={summary.demoRemoved} />}
        </div>
        <Link href="/plan" className="btn btn-primary w-full">Open Study Plan</Link>
        {summary.unassigned > 0 && (
          <Link href="/cards?day=unassigned" className="btn btn-secondary w-full">Assign unassigned cards</Link>
        )}
        <Link href="/settings/import/history" className="btn btn-ghost w-full">View import history</Link>
      </div>
    );
  }
  return null;
}

function SummaryRow({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${tone ?? ""}`}>{value.toLocaleString()}</span>
    </div>
  );
}

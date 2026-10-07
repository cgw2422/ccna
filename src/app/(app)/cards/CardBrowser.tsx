"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckSquare, ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { assignCardsToDay } from "./actions";

export type BrowserCard = { id: string; text: string; day: number | null; state: string; due: string | null; isDue: boolean };

type Filters = { q?: string; day?: string; domain?: string; status?: string; source?: string };

const STATE_STYLE: Record<string, string> = {
  NEW: "bg-primary-soft text-primary",
  LEARNING: "bg-danger-soft text-danger",
  RELEARNING: "bg-danger-soft text-danger",
  REVIEW: "bg-success-soft text-success",
};
const STATE_LABEL: Record<string, string> = { NEW: "New", LEARNING: "Learning", RELEARNING: "Relearning", REVIEW: "Learned" };

export function CardBrowser({
  cards,
  total,
  page,
  pageSize,
  filters,
  days,
  domains,
  sources,
}: {
  cards: BrowserCard[];
  total: number;
  page: number;
  pageSize: number;
  filters: Filters;
  days: { id: string; dayNumber: number; title: string }[];
  domains: { id: number; name: string }[];
  sources: { name: string; count: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q ?? "");
  const [sheet, setSheet] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function navigate(next: Filters & { page?: number }) {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeFilters = [
    filters.day && { key: "day", label: filters.day === "unassigned" ? "Unassigned" : `Day ${days.find((d) => d.id === filters.day)?.dayNumber ?? "?"}` },
    filters.domain && { key: "domain", label: domains.find((d) => String(d.id) === filters.domain)?.name ?? "Domain" },
    filters.status && { key: "status", label: { new: "New", learning: "Learning", learned: "Learned", due: "Due", weak: "Weak" }[filters.status] ?? filters.status },
    filters.source && { key: "source", label: filters.source },
  ].filter(Boolean) as { key: keyof Filters; label: string }[];

  const pages = Math.max(1, Math.ceil(total / pageSize));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function assign() {
    const ids = [...selected];
    startTransition(async () => {
      const n = await assignCardsToDay(ids, assignTo === "unassigned" ? null : assignTo);
      setSelected(new Set());
      setSelecting(false);
      setMessage(`${n} ${n === 1 ? "card" : "cards"} assigned`);
      setTimeout(() => setMessage(null), 4000);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q, page: 1 });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
          <input className="input pl-11" type="search" enterKeyHint="search" placeholder="Search cards" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cards" />
        </div>
        <button type="button" className="btn btn-secondary px-3.5" onClick={() => setSheet(true)} aria-label="Filters">
          <Filter className="size-5" />
          {activeFilters.length > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-fg">{activeFilters.length}</span>}
        </button>
      </form>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {activeFilters.map((f) => (
          <button key={f.key} className="chip chip-on" onClick={() => navigate({ [f.key]: undefined, page: 1 })}>
            {f.label} <X className="size-3.5" />
          </button>
        ))}
        <button
          className={`chip ${selecting ? "chip-on" : ""}`}
          onClick={() => {
            setSelecting(!selecting);
            setSelected(new Set());
          }}
        >
          <CheckSquare className="size-4" /> {selecting ? "Cancel" : "Select"}
        </button>
        {selecting && (
          <button className="chip" onClick={() => setSelected(new Set(cards.map((c) => c.id)))}>
            Select page ({cards.length})
          </button>
        )}
      </div>

      <ul className="panel divide-y divide-border overflow-hidden">
        {cards.map((c) => {
          const content = (
            <>
              {selecting && (
                <input
                  type="checkbox"
                  readOnly
                  checked={selected.has(c.id)}
                  className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                  aria-label="Select card"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-medium">{c.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="font-semibold">{c.day ? `Day ${c.day}` : "Unassigned"}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${STATE_STYLE[c.state]}`}>{STATE_LABEL[c.state]}</span>
                  {c.due && c.isDue && <span className="font-semibold text-warning">Due</span>}
                  {c.due && !c.isDue && <span>Due {new Date(c.due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
                </p>
              </div>
            </>
          );
          return (
            <li key={c.id}>
              {selecting ? (
                <button className="flex w-full items-start gap-3 px-4 py-3 text-left" onClick={() => toggle(c.id)}>
                  {content}
                </button>
              ) : (
                <Link href={`/cards/${c.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-surface-2">
                  {content}
                  <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted" />
                </Link>
              )}
            </li>
          );
        })}
        {cards.length === 0 && <li className="p-6 text-center text-sm text-muted">No cards match.</li>}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => navigate({ page: page - 1 })}>
            <ChevronLeft className="size-4" /> Prev
          </button>
          <span className="text-sm text-muted tabular-nums">
            Page {page} of {pages}
          </span>
          <button className="btn btn-secondary" disabled={page >= pages} onClick={() => navigate({ page: page + 1 })}>
            Next <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {selecting && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-surface px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <select className="input flex-1" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Assign to day">
              <option value="">Assign {selected.size} to…</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  Day {d.dayNumber} — {d.title}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
            <button className="btn btn-primary" disabled={!assignTo || pending} onClick={assign}>
              {pending ? "…" : "Assign"}
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-sm rounded-2xl bg-text px-4 py-3 text-center text-sm font-medium text-bg shadow-lg max-sm:mx-4" role="status">
          {message}
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filter cards">
        <FilterForm
          filters={filters}
          days={days}
          domains={domains}
          sources={sources}
          onApply={(f) => {
            setSheet(false);
            navigate({ ...f, page: 1 });
          }}
        />
      </Sheet>
    </div>
  );
}

function FilterForm({
  filters,
  days,
  domains,
  sources,
  onApply,
}: {
  filters: Filters;
  days: { id: string; dayNumber: number; title: string }[];
  domains: { id: number; name: string }[];
  sources: { name: string; count: number }[];
  onApply: (f: Filters) => void;
}) {
  const [f, setF] = useState<Filters>(filters);
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="f-day">Jeremy day</label>
        <select id="f-day" className="input" value={f.day ?? ""} onChange={(e) => setF({ ...f, day: e.target.value || undefined })}>
          <option value="">All days</option>
          <option value="unassigned">Unassigned</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayNumber} — {d.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-domain">CCNA domain</label>
        <select id="f-domain" className="input" value={f.domain ?? ""} onChange={(e) => setF({ ...f, domain: e.target.value || undefined })}>
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div>
        <p className="label">Status</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Any"],
            ["new", "New"],
            ["learning", "Learning"],
            ["learned", "Learned"],
            ["due", "Due"],
            ["weak", "Weak"],
          ].map(([v, l]) => (
            <button key={v} type="button" className={`chip min-h-10 ${(f.status ?? "") === v ? "chip-on" : ""}`} onClick={() => setF({ ...f, status: v || undefined })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="f-source">Source</label>
        <select id="f-source" className="input" value={f.source ?? ""} onChange={(e) => setF({ ...f, source: e.target.value || undefined })}>
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({s.count})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button className="btn btn-secondary" onClick={() => onApply({ q: filters.q })}>
          Clear
        </button>
        <button className="btn btn-primary" onClick={() => onApply(f)}>
          Apply
        </button>
      </div>
    </div>
  );
}

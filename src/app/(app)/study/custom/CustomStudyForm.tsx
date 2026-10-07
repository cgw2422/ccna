"use client";

import { useActionState, useState } from "react";
import { startCustomSession } from "../actions";
import type { DayStatusValue } from "@/lib/ccna";

type Mode = "days" | "range" | "domain" | "weak" | "missed" | "due" | "random";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "days", label: "Specific days", hint: "Choose one or more study days" },
  { value: "range", label: "Day range", hint: "e.g. Day 1 to Day 20" },
  { value: "domain", label: "CCNA domain", hint: "All days tagged with a domain" },
  { value: "weak", label: "Weak cards", hint: "Cards you often rate Again or Hard" },
  { value: "missed", label: "Missed cards", hint: "Cards you rated Again recently" },
  { value: "due", label: "Due cards", hint: "Due today, or review ahead" },
  { value: "random", label: "Random cards", hint: "A random mix" },
];

export function CustomStudyForm({
  days,
  domains,
}: {
  days: { id: string; dayNumber: number; title: string; cards: number; status: DayStatusValue }[];
  domains: { id: number; name: string }[];
}) {
  const [mode, setMode] = useState<Mode>("days");
  const [selected, setSelected] = useState<string[]>([]);
  const [state, action, pending] = useActionState(startCustomSession, {});
  const scoped = mode === "days" || mode === "range" || mode === "domain" || mode === "random";
  const maxDay = Math.max(1, ...days.map((d) => d.dayNumber));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <section>
        <p className="section-title">Study by</p>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.value}
              onClick={() => setMode(m.value)}
              aria-pressed={mode === m.value}
              className={`panel min-h-16 px-3 py-2.5 text-left ${mode === m.value ? "border-primary bg-primary-soft" : ""}`}
            >
              <span className={`block text-sm font-semibold ${mode === m.value ? "text-primary" : ""}`}>{m.label}</span>
              <span className="block text-xs text-muted">{m.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {mode === "days" && (
        <section className="panel max-h-80 overflow-y-auto p-2">
          {days.map((d) => (
            <label key={d.id} className="flex min-h-12 items-center gap-3 rounded-xl px-2 active:bg-surface-2">
              <input
                type="checkbox"
                name="dayIds"
                value={d.id}
                checked={selected.includes(d.id)}
                onChange={(e) => setSelected(e.target.checked ? [...selected, d.id] : selected.filter((x) => x !== d.id))}
                className="size-5 accent-[var(--primary)]"
              />
              <span className="w-14 shrink-0 text-sm font-bold text-muted tabular-nums">Day {d.dayNumber}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
              {d.status === "PAUSED" && <span className="text-xs text-muted">paused</span>}
            </label>
          ))}
          {days.length === 0 && <p className="p-4 text-center text-sm text-muted">No study days yet.</p>}
        </section>
      )}

      {mode === "range" && (
        <section className="panel grid grid-cols-2 gap-3 p-4">
          <div>
            <label className="label" htmlFor="fromDay">From Day</label>
            <input className="input text-center font-bold" id="fromDay" name="fromDay" type="number" inputMode="numeric" min={1} max={maxDay} defaultValue={1} />
          </div>
          <div>
            <label className="label" htmlFor="toDay">To Day</label>
            <input className="input text-center font-bold" id="toDay" name="toDay" type="number" inputMode="numeric" min={1} max={maxDay} defaultValue={Math.min(maxDay, 20)} />
          </div>
        </section>
      )}

      {mode === "domain" && (
        <section className="panel p-4">
          <label className="label" htmlFor="domainId">CCNA domain</label>
          <select className="input" id="domainId" name="domainId" defaultValue={domains[0]?.id}>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </section>
      )}

      {mode === "missed" && (
        <section className="panel p-4">
          <label className="label" htmlFor="missedDays">Missed in the last</label>
          <select className="input" id="missedDays" name="missedDays" defaultValue="7">
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </section>
      )}

      {mode === "due" && (
        <section className="panel p-4">
          <label className="label" htmlFor="aheadDays">Include cards due within</label>
          <select className="input" id="aheadDays" name="aheadDays" defaultValue="0">
            <option value="0">Today</option>
            <option value="1">Tomorrow</option>
            <option value="3">Next 3 days</option>
            <option value="7">Next 7 days</option>
          </select>
        </section>
      )}

      <section className="panel divide-y divide-border">
        <div className="flex items-center justify-between gap-3 p-4">
          <label htmlFor="limit" className="font-medium">Maximum cards</label>
          <select className="input w-28" id="limit" name="limit" defaultValue="50">
            {[10, 20, 30, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        {scoped && (
          <label className="flex min-h-14 items-center justify-between gap-3 p-4">
            <span>
              <span className="block font-medium">Include unseen cards</span>
              <span className="block text-xs text-muted">Otherwise only cards you&apos;ve studied before</span>
            </span>
            <input type="checkbox" name="includeNew" defaultChecked className="size-5 accent-[var(--primary)]" />
          </label>
        )}
        <label className="flex min-h-14 items-center justify-between gap-3 p-4">
          <span>
            <span className="block font-medium">Include paused days</span>
            <span className="block text-xs text-muted">Doesn&apos;t change your Study Plan</span>
          </span>
          <input type="checkbox" name="includePaused" className="size-5 accent-[var(--primary)]" />
        </label>
      </section>
      <input type="hidden" name="label" value={MODES.find((m) => m.value === mode)?.label} />

      {state?.error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{state.error}</p>}
      <button className="btn btn-primary min-h-14 w-full text-lg" disabled={pending || (mode === "days" && selected.length === 0)}>
        {pending ? "Building session…" : "Start Custom Session"}
      </button>
    </form>
  );
}

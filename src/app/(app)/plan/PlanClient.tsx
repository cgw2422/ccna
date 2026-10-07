"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import type { DayStatusValue } from "@/lib/ccna";
import { Sheet } from "@/components/Sheet";
import { StatusSegmented } from "@/components/StatusSegmented";
import { applyDayStatuses, setAllDayStatus, setDayStatus, setRangeDayStatus, setUnassignedStatus } from "./actions";

export type PlanDay = {
  id: string;
  dayNumber: number;
  title: string;
  cardCount: number;
  status: DayStatusValue;
  domainIds: number[];
};

type Filter = "ALL" | DayStatusValue;
type Toast = { message: string; undo?: { dayId: string; status: DayStatusValue }[] } | null;

const SHORT_DOMAIN: Record<number, string> = {
  1: "Fundamentals",
  2: "Access",
  3: "IP Connectivity",
  4: "IP Services",
  5: "Security",
  6: "Automation",
};

export function PlanClient({
  days,
  unassigned,
}: {
  days: PlanDay[];
  unassigned: { count: number; status: DayStatusValue };
  domains: { id: number; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [optimisticDays, applyOptimistic] = useOptimistic(days, (state, changes: Record<string, DayStatusValue>) =>
    state.map((d) => (changes[d.id] ? { ...d, status: changes[d.id] } : d)),
  );
  const [optimisticUnassigned, setOptimisticUnassigned] = useOptimistic(unassigned.status);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const counts = useMemo(() => {
    const c = { ACTIVE: 0, REVIEW_ONLY: 0, PAUSED: 0 };
    for (const d of optimisticDays) c[d.status]++;
    return c;
  }, [optimisticDays]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dayMatch = /^(?:day\s*)?(\d{1,3})$/.exec(q);
    return optimisticDays.filter((d) => {
      if (filter !== "ALL" && d.status !== filter) return false;
      if (!q) return true;
      if (dayMatch) return d.dayNumber === Number(dayMatch[1]);
      return d.title.toLowerCase().includes(q) || d.domainIds.some((id) => SHORT_DOMAIN[id]?.toLowerCase().includes(q));
    });
  }, [optimisticDays, query, filter]);

  function showToast(t: Toast) {
    setToast(t);
    if (t) setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 6000);
  }

  function snapshot(ids?: Set<string>) {
    return optimisticDays.filter((d) => !ids || ids.has(d.id)).map((d) => ({ dayId: d.id, status: d.status }));
  }

  function changeDay(day: PlanDay, status: DayStatusValue) {
    if (day.status === status) return;
    startTransition(async () => {
      applyOptimistic({ [day.id]: status });
      await setDayStatus(day.id, status);
    });
  }

  function changeAll(status: DayStatusValue, label: string) {
    const prev = snapshot();
    startTransition(async () => {
      applyOptimistic(Object.fromEntries(optimisticDays.map((d) => [d.id, status])));
      await setAllDayStatus(status);
    });
    showToast({ message: label, undo: prev });
  }

  function changeRange(from: number, to: number, status: DayStatusValue) {
    const lo = Math.min(from, to), hi = Math.max(from, to);
    const ids = new Set(optimisticDays.filter((d) => d.dayNumber >= lo && d.dayNumber <= hi).map((d) => d.id));
    const prev = snapshot(ids);
    startTransition(async () => {
      applyOptimistic(Object.fromEntries([...ids].map((id) => [id, status])));
      await setRangeDayStatus(from, to, status);
    });
    setRangeOpen(false);
    const label = { ACTIVE: "Active", REVIEW_ONLY: "Review Only", PAUSED: "Paused" }[status];
    showToast({ message: `Days ${lo}–${hi} set to ${label} (${ids.size})`, undo: prev });
  }

  function undo(entries: { dayId: string; status: DayStatusValue }[]) {
    startTransition(async () => {
      applyOptimistic(Object.fromEntries(entries.map((e) => [e.dayId, e.status])));
      await applyDayStatuses(entries);
    });
    setToast(null);
  }

  return (
    <div className="space-y-3">
      {/* Bulk controls */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button className="chip min-h-10 text-text" onClick={() => changeAll("ACTIVE", "All days set to Active")}>
          <span className="size-2 rounded-full bg-success" /> Activate All
        </button>
        <button className="chip min-h-10 text-text" onClick={() => changeAll("REVIEW_ONLY", "All days set to Review Only")}>
          <span className="size-2 rounded-full bg-warning" /> Set All Review Only
        </button>
        <button className="chip min-h-10 text-text" onClick={() => changeAll("PAUSED", "All days paused")}>
          <span className="size-2 rounded-full bg-paused" /> Pause All
        </button>
        <button className="chip min-h-10 border-primary text-primary" onClick={() => setRangeOpen(true)}>
          <SlidersHorizontal className="size-4" /> Select Range
        </button>
      </div>

      {/* Search + filter */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
        <input
          className="input pl-11"
          placeholder="Search topic or day number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          enterKeyHint="search"
          aria-label="Search study days"
        />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Filter by status">
        {(
          [
            ["ALL", `All ${optimisticDays.length}`],
            ["ACTIVE", `Active ${counts.ACTIVE}`],
            ["REVIEW_ONLY", `Review Only ${counts.REVIEW_ONLY}`],
            ["PAUSED", `Paused ${counts.PAUSED}`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={filter === key} className={`chip ${filter === key ? "chip-on" : ""}`} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Days */}
      <ul className="space-y-2.5">
        {visible.map((d) => (
          <li key={d.id} className="panel overflow-hidden">
            <Link href={`/plan/${d.id}`} className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
              <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2">
                <span className="text-[10px] leading-none font-bold text-muted uppercase">Day</span>
                <span className="text-lg leading-tight font-extrabold tabular-nums">{d.dayNumber}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{d.title}</p>
                <p className="truncate text-sm text-muted">
                  {d.cardCount} {d.cardCount === 1 ? "card" : "cards"}
                  {d.domainIds.length > 0 && <> · {d.domainIds.map((id) => SHORT_DOMAIN[id]).join(", ")}</>}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </Link>
            <div className="px-3 pb-3">
              <StatusSegmented value={d.status} onChange={(s) => changeDay(d, s)} label={`Day ${d.dayNumber} status`} />
            </div>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="panel p-6 text-center text-sm text-muted">
            {optimisticDays.length === 0 ? "No study days yet — import Jeremy's deck in Settings → Import." : "No days match your search."}
          </li>
        )}
      </ul>

      {/* Unassigned bucket */}
      {(unassigned.count > 0 || filter === "ALL") && !query && (
        <div className="panel overflow-hidden">
          <Link href="/cards?day=unassigned" className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-lg font-extrabold text-muted">?</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Unassigned</p>
              <p className="text-sm text-muted">
                {unassigned.count} {unassigned.count === 1 ? "card" : "cards"} without a detected day · tap to assign
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted" />
          </Link>
          <div className="px-3 pb-3">
            <StatusSegmented
              value={optimisticUnassigned}
              label="Unassigned status"
              onChange={(s) =>
                startTransition(async () => {
                  setOptimisticUnassigned(s);
                  await setUnassignedStatus(s);
                })
              }
            />
          </div>
        </div>
      )}

      <RangeSheet open={rangeOpen} onClose={() => setRangeOpen(false)} onApply={changeRange} maxDay={Math.max(1, ...optimisticDays.map((d) => d.dayNumber))} />

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-text px-4 py-3 text-sm text-bg shadow-lg max-sm:mx-4" role="status">
          <span className="flex-1 font-medium">{toast.message}</span>
          {toast.undo && (
            <button className="min-h-9 px-2 font-bold text-primary-soft underline" onClick={() => undo(toast.undo!)}>
              Undo
            </button>
          )}
          <button aria-label="Dismiss" onClick={() => setToast(null)} className="flex size-8 items-center justify-center">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function RangeSheet({
  open,
  onClose,
  onApply,
  maxDay,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (from: number, to: number, status: DayStatusValue) => void;
  maxDay: number;
}) {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(20, maxDay));
  const [status, setStatus] = useState<DayStatusValue>("ACTIVE");
  return (
    <Sheet open={open} onClose={onClose} title="Select Range">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="from">From Day</label>
          <input id="from" className="input text-center text-lg font-bold" type="number" inputMode="numeric" min={1} max={maxDay} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="to">To Day</label>
          <input id="to" className="input text-center text-lg font-bold" type="number" inputMode="numeric" min={1} max={maxDay} value={to} onChange={(e) => setTo(Number(e.target.value))} />
        </div>
      </div>
      <p className="label mt-5">Set these days to</p>
      <StatusSegmented value={status} onChange={setStatus} label="Range status" size="lg" />
      <button className="btn btn-primary mt-6 w-full" onClick={() => onApply(from || 1, to || 1, status)}>
        Apply to Days {Math.min(from, to)}–{Math.max(from, to)}
      </button>
    </Sheet>
  );
}

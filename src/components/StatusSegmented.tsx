"use client";

import type { DayStatusValue } from "@/lib/ccna";

const OPTIONS: { value: DayStatusValue; label: string; on: string }[] = [
  { value: "ACTIVE", label: "Active", on: "bg-success text-white dark:text-bg" },
  { value: "REVIEW_ONLY", label: "Review Only", on: "bg-warning text-white dark:text-bg" },
  { value: "PAUSED", label: "Paused", on: "bg-paused text-white dark:text-bg" },
];

export function StatusSegmented({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: DayStatusValue;
  onChange: (v: DayStatusValue) => void;
  label: string;
  size?: "md" | "lg";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      {OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`${size === "lg" ? "min-h-12" : "min-h-10"} rounded-lg px-1 text-[13px] font-semibold transition ${
              selected ? `${o.on} shadow-sm` : "text-muted active:bg-surface"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

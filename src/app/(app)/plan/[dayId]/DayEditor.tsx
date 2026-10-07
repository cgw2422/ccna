"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { DayStatusValue } from "@/lib/ccna";
import { StatusSegmented } from "@/components/StatusSegmented";
import { setDayStatus, updateDayDetails } from "../actions";

export function DayEditor({
  dayId,
  title: initialTitle,
  status: initialStatus,
  domainIds: initialDomains,
  domains,
}: {
  dayId: string;
  title: string;
  status: DayStatusValue;
  domainIds: number[];
  domains: { id: number; name: string }[];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [title, setTitle] = useState(initialTitle);
  const [domainIds, setDomainIds] = useState(initialDomains);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = title !== initialTitle || domainIds.slice().sort().join() !== initialDomains.slice().sort().join();

  return (
    <>
      <section className="panel p-4">
        <h2 className="mb-1 font-bold">Status</h2>
        <p className="mb-3 text-sm text-muted">
          {status === "ACTIVE" && "New cards and due reviews from this day appear in your study sessions."}
          {status === "REVIEW_ONLY" && "No new cards. Cards you've already studied still appear when due."}
          {status === "PAUSED" && "Nothing from this day appears. All progress is preserved."}
        </p>
        <StatusSegmented
          value={status}
          label="Day status"
          size="lg"
          onChange={(s) => {
            setStatus(s);
            startTransition(() => setDayStatus(dayId, s));
          }}
        />
      </section>

      <section className="panel p-4">
        <h2 className="mb-3 font-bold">Details</h2>
        <label className="label" htmlFor="title">Topic title</label>
        <input id="title" className="input" value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
        <p className="mt-1.5 text-xs text-muted">Renaming a day never changes the imported flashcards.</p>

        <p className="label mt-4">CCNA domains</p>
        <div className="flex flex-wrap gap-2">
          {domains.map((d) => {
            const on = domainIds.includes(d.id);
            return (
              <button
                type="button"
                key={d.id}
                aria-pressed={on}
                onClick={() => { setDomainIds(on ? domainIds.filter((x) => x !== d.id) : [...domainIds, d.id]); setSaved(false); }}
                className={`chip min-h-10 ${on ? "chip-on" : ""}`}
              >
                {on && <Check className="size-4" />} {d.name}
              </button>
            );
          })}
        </div>
        <button
          className="btn btn-primary mt-5 w-full"
          disabled={!dirty || pending || !title.trim()}
          onClick={() =>
            startTransition(async () => {
              await updateDayDetails(dayId, { title, domainIds });
              setSaved(true);
            })
          }
        >
          {saved && !dirty ? "Saved" : pending ? "Saving…" : "Save changes"}
        </button>
      </section>
    </>
  );
}

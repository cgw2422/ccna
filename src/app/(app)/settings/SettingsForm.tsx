"use client";

import { useActionState, useEffect, useState } from "react";
import { saveSettings } from "./actions";

type Initial = {
  newCardsPerDay: number;
  maxReviewsPerDay: number | null;
  autoShowAnswerSeconds: number | null;
  randomizeNewCards: boolean;
  desiredRetention: number;
  examDate: string;
  timezone: string;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState(saveSettings, {});
  const [dirty, setDirty] = useState(false);
  const [zones, setZones] = useState<string[]>([initial.timezone]);
  useEffect(() => {
    try {
      const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
      if (all?.length) setZones(Array.from(new Set([initial.timezone, "UTC", ...all])));
    } catch {}
  }, [initial.timezone]);
  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  return (
    <form action={action} onChange={() => setDirty(true)} className="space-y-5">
      <section>
        <p className="section-title">Study settings</p>
        <div className="panel divide-y divide-border">
          <Row label="New cards per day" htmlFor="newCardsPerDay">
            <input id="newCardsPerDay" name="newCardsPerDay" type="number" inputMode="numeric" min={0} max={9999} defaultValue={initial.newCardsPerDay} className="input w-24 text-right" />
          </Row>
          <Row label="Review limit per day" hint="Leave empty for unlimited" htmlFor="maxReviewsPerDay">
            <input id="maxReviewsPerDay" name="maxReviewsPerDay" type="number" inputMode="numeric" min={0} placeholder="∞" defaultValue={initial.maxReviewsPerDay ?? ""} className="input w-24 text-right" />
          </Row>
          <Row label="Show answer automatically" htmlFor="autoShowAnswerSeconds">
            <select id="autoShowAnswerSeconds" name="autoShowAnswerSeconds" defaultValue={initial.autoShowAnswerSeconds ?? ""} className="input w-28">
              <option value="">Off</option>
              {[5, 10, 15, 20, 30, 60].map((s) => (
                <option key={s} value={s}>After {s}s</option>
              ))}
            </select>
          </Row>
          <label className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
            <span>
              <span className="block font-medium">Randomize new cards</span>
              <span className="block text-xs text-muted">Off = course order (Day 1 first)</span>
            </span>
            <input type="checkbox" name="randomizeNewCards" defaultChecked={initial.randomizeNewCards} className="size-6 accent-[var(--primary)]" />
          </label>
          <Row label="Target retention" hint="FSRS: higher = more reviews, better recall" htmlFor="desiredRetention">
            <select id="desiredRetention" name="desiredRetention" defaultValue={String(initial.desiredRetention)} className="input w-24">
              {[0.8, 0.85, 0.9, 0.92, 0.95].map((r) => (
                <option key={r} value={r}>{Math.round(r * 100)}%</option>
              ))}
            </select>
          </Row>
        </div>
      </section>

      <section id="exam">
        <p className="section-title">Exam</p>
        <div className="panel divide-y divide-border">
          <Row label="CCNA exam date" htmlFor="examDate">
            <input id="examDate" name="examDate" type="date" defaultValue={initial.examDate} className="input w-44" />
          </Row>
          <Row label="Time zone" hint="Your study day resets at local midnight" htmlFor="timezone">
            <select id="timezone" name="timezone" defaultValue={initial.timezone} className="input w-44">
              {zones.map((z) => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </Row>
        </div>
      </section>

      {state?.error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending || !dirty}>
        {pending ? "Saving…" : state?.ok && !dirty ? "Saved ✓" : "Save settings"}
      </button>
    </form>
  );
}

function Row({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-2.5">
      <label htmlFor={htmlFor} className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

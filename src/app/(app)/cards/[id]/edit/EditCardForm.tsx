"use client";

import { useActionState } from "react";
import { deleteCard, updateCard } from "../../actions";

export function EditCardForm({
  cardId,
  front,
  back,
  tags,
  dayId,
  days,
}: {
  cardId: string;
  front: string;
  back: string;
  tags: string;
  dayId: string;
  days: { id: string; dayNumber: number; title: string }[];
}) {
  const [state, action, pending] = useActionState(updateCard.bind(null, cardId), {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="front">Front (HTML allowed)</label>
        <textarea id="front" name="front" defaultValue={front} rows={6} className="input py-3 font-mono text-sm" required />
      </div>
      <div>
        <label className="label" htmlFor="back">Back (HTML allowed)</label>
        <textarea id="back" name="back" defaultValue={back} rows={8} className="input py-3 font-mono text-sm" />
        <p className="mt-1.5 text-xs text-muted">Tip: CLI lines like <code>show ip route</code> are shown in monospace automatically. Use ``` for multi-line code.</p>
      </div>
      <div>
        <label className="label" htmlFor="dayId">Study day</label>
        <select id="dayId" name="dayId" defaultValue={dayId} className="input">
          <option value="">Unassigned</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>Day {d.dayNumber} — {d.title}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="tags">Tags (space separated)</label>
        <input id="tags" name="tags" defaultValue={tags} className="input" />
      </div>
      {state?.error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{state.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Saving…" : "Save card"}</button>
      <button
        type="button"
        className="btn btn-danger w-full"
        onClick={() => {
          if (confirm("Delete this card and its review history? This cannot be undone.")) deleteCard(cardId);
        }}
      >
        Delete card
      </button>
    </form>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Sheet } from "./Sheet";
import { countCardsForDelete, deleteCards, type CardTarget } from "@/app/(app)/cards/actions";

const TYPE_TO_CONFIRM_ABOVE = 100;

export function DeleteCardsSheet({
  open,
  onClose,
  target,
  title = "Delete cards",
  defaultRemoveEmptyDays = false,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  target: CardTarget;
  title?: string;
  defaultRemoveEmptyDays?: boolean;
  onDeleted?: (result: { count: number; daysRemoved: number }) => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [removeDays, setRemoveDays] = useState(defaultRemoveEmptyDays);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const targetKey = JSON.stringify(target);

  useEffect(() => {
    if (!open) return;
    setCount(null);
    setTyped("");
    setError(null);
    setRemoveDays(defaultRemoveEmptyDays);
    countCardsForDelete(JSON.parse(targetKey))
      .then(setCount)
      .catch(() => setError("Couldn't count cards."));
  }, [open, targetKey, defaultRemoveEmptyDays]);

  const needsTyping = target.kind === "all" || (count ?? 0) > TYPE_TO_CONFIRM_ABOVE;
  const canDelete = count != null && count > 0 && (!needsTyping || typed.trim().toUpperCase() === "DELETE") && !pending;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {count == null && !error ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-muted" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-danger-soft p-3.5 text-sm text-danger">
            <AlertTriangle className="size-5 shrink-0" />
            <p>
              <b>
                {count?.toLocaleString()} {count === 1 ? "card" : "cards"}
              </b>{" "}
              will be permanently deleted, including their review history and progress. This can&apos;t be undone.
            </p>
          </div>
          <p className="text-sm text-muted">
            Want a backup first?{" "}
            <a className="font-semibold text-primary" href="/api/export?format=json">
              Export everything
            </a>
          </p>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Remove study days left empty</span>
              <span className="block text-xs text-muted">Days that still have cards are kept</span>
            </span>
            <input type="checkbox" checked={removeDays} onChange={(e) => setRemoveDays(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          </label>
          {needsTyping && (count ?? 0) > 0 && (
            <div>
              <label className="label" htmlFor="confirm-delete">
                Type <b className="text-text">DELETE</b> to confirm
              </label>
              <input id="confirm-delete" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
            </div>
          )}
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-secondary" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button
              className="btn bg-danger text-white"
              disabled={!canDelete}
              onClick={() =>
                start(async () => {
                  try {
                    const r = await deleteCards(target, { removeEmptyDays: removeDays });
                    onDeleted?.(r);
                    onClose();
                  } catch {
                    setError("Delete failed — please try again.");
                  }
                })
              }
            >
              {pending ? "Deleting…" : count === 0 ? "Nothing to delete" : `Delete ${count?.toLocaleString() ?? ""}`}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

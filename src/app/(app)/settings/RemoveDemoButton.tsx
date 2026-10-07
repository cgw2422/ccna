"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeDemoCards } from "./actions";

export function RemoveDemoButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm(`Remove ${count} demo cards and any empty demo days? Imported cards are not affected.`)) start(async () => void (await removeDemoCards()));
      }}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
    >
      <Trash2 className="size-5 text-danger" />
      <span className="flex-1">
        <span className="block font-medium text-danger">{pending ? "Removing…" : "Remove demo cards"}</span>
        <span className="block text-xs text-muted">{count} sample cards created at sign-up</span>
      </span>
    </button>
  );
}

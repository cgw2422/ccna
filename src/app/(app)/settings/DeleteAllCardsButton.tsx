"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { DeleteCardsSheet } from "@/components/DeleteCardsSheet";

export function DeleteAllCardsButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left" disabled={count === 0}>
        <Trash2 className="size-5 text-danger" />
        <span className="flex-1">
          <span className="block font-medium text-danger">Delete all cards</span>
          <span className="block text-xs text-muted">{count.toLocaleString()} cards · start fresh before a new import</span>
        </span>
      </button>
      <DeleteCardsSheet
        open={open}
        onClose={() => setOpen(false)}
        target={{ kind: "all" }}
        title="Delete all cards"
        defaultRemoveEmptyDays
        onDeleted={() => router.refresh()}
      />
    </>
  );
}

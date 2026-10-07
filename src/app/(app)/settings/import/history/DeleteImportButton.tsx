"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { DeleteCardsSheet } from "@/components/DeleteCardsSheet";

export function DeleteImportButton({ batchId, fileName }: { batchId: string; fileName: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button className="btn btn-danger min-h-10 shrink-0 px-3 text-sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Delete cards
      </button>
      <DeleteCardsSheet
        open={open}
        onClose={() => setOpen(false)}
        target={{ kind: "import", importBatchId: batchId }}
        title={`Delete cards from ${fileName}`}
        defaultRemoveEmptyDays
        onDeleted={() => router.refresh()}
      />
    </>
  );
}

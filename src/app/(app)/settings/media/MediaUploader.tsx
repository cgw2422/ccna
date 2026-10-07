"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

export function MediaUploader() {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(files: FileList) {
    setBusy(true);
    setMsg(null);
    let saved = 0;
    const skipped: string[] = [];
    try {
      const list = Array.from(files);
      for (let i = 0; i < list.length; i += 20) {
        const form = new FormData();
        list.slice(i, i + 20).forEach((f) => form.append("files", f));
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        saved += data.saved;
        skipped.push(...data.skipped);
      }
      setMsg(`${saved} uploaded${skipped.length ? `, ${skipped.length} skipped (not an image or too large)` : ""}.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary w-full" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />} Upload images
      </button>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      {msg && <p className="mt-2 text-center text-sm text-muted">{msg}</p>}
    </div>
  );
}

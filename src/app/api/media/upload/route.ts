import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { saveMedia } from "@/lib/media";
import { HttpError } from "@/lib/study/session";

export const maxDuration = 120;

export const POST = withUser(async (req, user) => {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "No files uploaded");
  const deck = await ensureDeck(prisma, user.id);
  let saved = 0;
  const skipped: string[] = [];
  for (const f of files) {
    const ok = await saveMedia({ userId: user.id, deckId: deck.id, filename: f.name, data: new Uint8Array(await f.arrayBuffer()) });
    if (ok) saved++;
    else skipped.push(f.name);
  }
  return { saved, skipped };
});

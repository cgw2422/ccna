import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { HttpError } from "@/lib/study/session";
import { parseApkg } from "@/lib/import/apkg";
import { saveMedia } from "@/lib/media";

export const maxDuration = 300;

/** Upload an Anki .apkg: parses notes, stores images, returns rows for the mapping screen. */
export const POST = withUser(async (req, user) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
  if (file.size > 500 * 1024 * 1024) throw new HttpError(413, "File too large (max 500 MB)");
  let parsed;
  try {
    parsed = await parseApkg(new Uint8Array(await file.arrayBuffer()));
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Could not read .apkg file");
  }
  const deck = await ensureDeck(prisma, user.id);
  const batch = await prisma.importBatch.create({
    data: { userId: user.id, deckId: deck.id, fileName: file.name.slice(0, 255), format: "apkg" },
  });
  let mediaCount = 0;
  for (const m of parsed.media) {
    const saved = await saveMedia({ userId: user.id, deckId: deck.id, importBatchId: batch.id, filename: m.filename, data: m.data });
    if (saved) mediaCount++;
  }
  await prisma.importBatch.update({ where: { id: batch.id }, data: { mediaCount } });
  const { media: _media, ...table } = parsed;
  void _media;
  return { batchId: batch.id, mediaCount, table };
});

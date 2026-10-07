import { z } from "zod";
import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { DEFAULT_SOURCE } from "@/lib/ccna";
import { HttpError } from "@/lib/study/session";
import { IMPORT_FIELDS } from "@/lib/import/types";

const body = z.object({
  batchId: z.string().optional(),
  fileName: z.string().min(1).max(255),
  format: z.enum(["csv", "tsv", "txt", "apkg"]),
  mapping: z.record(z.enum(IMPORT_FIELDS), z.number().int().min(-1)),
  options: z.object({
    source: z.string().trim().min(1).max(100).default(DEFAULT_SOURCE),
    duplicateMode: z.enum(["update", "new", "skip"]).default("update"),
    fieldsAreHtml: z.boolean().default(true),
    removeDemo: z.boolean().default(false),
  }),
});

/** Create (or configure an already-uploaded .apkg) import batch. */
export const POST = withUser(async (req, user) => {
  const input = body.parse(await req.json());
  if (input.mapping.front === undefined || input.mapping.front < 0) throw new HttpError(400, "Map a column to the question (front).");
  const deck = await ensureDeck(prisma, user.id);
  const max = await prisma.card.aggregate({ where: { deckId: deck.id }, _max: { sortIndex: true } });
  const options = { ...input.options, baseSortIndex: (max._max.sortIndex ?? 0) + 1 };
  if (input.batchId) {
    const existing = await prisma.importBatch.findFirst({ where: { id: input.batchId, userId: user.id, status: "PENDING" } });
    if (!existing) throw new HttpError(404, "Import not found");
    await prisma.importBatch.update({ where: { id: existing.id }, data: { mapping: input.mapping, options, source: input.options.source } });
    return { id: existing.id };
  }
  const batch = await prisma.importBatch.create({
    data: {
      userId: user.id,
      deckId: deck.id,
      fileName: input.fileName,
      format: input.format === "txt" ? "tsv" : input.format,
      source: input.options.source,
      mapping: input.mapping,
      options,
    },
  });
  return { id: batch.id };
});

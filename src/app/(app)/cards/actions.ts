"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureDeck } from "@/lib/userSetup";
import { sanitizeCardHtml } from "@/lib/content/sanitize";
import { cardHashes } from "@/lib/content/hash";
import { splitTags } from "@/lib/import/dayDetect";
import { buildCardWhere, type CardFilterParams } from "@/lib/cardFilters";
import { getStudyContext } from "@/lib/study/queue";
import type { Prisma } from "@prisma/client";

export async function assignCardsToDay(target: CardTarget | string[], dayId: string | null) {
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const deck = await ensureDeck(prisma, user.id);
  if (dayId) {
    const day = await prisma.studyDay.findFirst({ where: { id: dayId, deckId: deck.id } });
    if (!day) throw new Error("Day not found");
  }
  const t: CardTarget = Array.isArray(target) ? { kind: "ids", ids: target } : target;
  const where = await resolveTarget(user.id, ctx, t);
  const { count } = await prisma.card.updateMany({ where, data: { studyDayId: dayId, dayAssignedManually: true } });
  revalidatePath("/", "layout");
  return count;
}

async function resolveTarget(userId: string, ctx: Awaited<ReturnType<typeof getStudyContext>>, target: CardTarget): Promise<Prisma.CardWhereInput> {
  switch (target.kind) {
    case "ids":
      return { deckId: { in: ctx.deckIds }, id: { in: z.array(z.string()).max(20000).parse(target.ids) } };
    case "filters":
      return buildCardWhere(userId, ctx.deckIds, ctx.dayEnd, target.filters);
    case "import": {
      const batch = await prisma.importBatch.findFirst({ where: { id: target.importBatchId, userId } });
      if (!batch) throw new Error("Import not found");
      return { deckId: { in: ctx.deckIds }, importBatchId: batch.id };
    }
    case "all":
      return { deckId: { in: ctx.deckIds } };
  }
}

const editSchema = z.object({
  front: z.string().min(1, "Front can't be empty").max(100_000),
  back: z.string().max(100_000),
  tags: z.string().max(2000).default(""),
  dayId: z.string().optional(),
});

export async function updateCard(cardId: string, _: unknown, form: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const card = await prisma.card.findFirst({ where: { id: cardId, deckId: deck.id } });
  if (!card) return { error: "Card not found" };
  const parsed = editSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const front = sanitizeCardHtml(parsed.data.front);
  const back = sanitizeCardHtml(parsed.data.back);
  const tags = splitTags(parsed.data.tags);
  let studyDayId = card.studyDayId;
  if (parsed.data.dayId !== undefined) {
    studyDayId = parsed.data.dayId === "" ? null : parsed.data.dayId;
    if (studyDayId && !(await prisma.studyDay.findFirst({ where: { id: studyDayId, deckId: deck.id } }))) return { error: "Invalid day" };
  }
  await prisma.$transaction([
    prisma.card.update({
      where: { id: card.id },
      data: {
        front,
        back,
        ...cardHashes(front, back),
        studyDayId,
        dayAssignedManually: studyDayId !== card.studyDayId ? true : card.dayAssignedManually,
      },
    }),
    prisma.cardTag.deleteMany({ where: { cardId: card.id } }),
    prisma.cardTag.createMany({ data: tags.map((tag) => ({ cardId: card.id, tag })) }),
  ]);
  revalidatePath("/", "layout");
  redirect(`/cards/${card.id}`);
}

export async function deleteCard(cardId: string) {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  await prisma.card.deleteMany({ where: { id: cardId, deckId: deck.id } });
  revalidatePath("/", "layout");
  redirect("/cards");
}

export type CardTarget =
  | { kind: "ids"; ids: string[] }
  | { kind: "filters"; filters: CardFilterParams }
  | { kind: "import"; importBatchId: string }
  | { kind: "all" };

/**
 * Permanently delete cards (and their progress/review history) for the
 * current user's deck. Optionally removes study days the deletion left empty.
 */
export async function deleteCards(target: CardTarget, opts: { removeEmptyDays?: boolean } = {}) {
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const where = await resolveTarget(user.id, ctx, target);
  const affectedDays = await prisma.card.findMany({ where: { ...where, studyDayId: { not: null } }, select: { studyDayId: true }, distinct: ["studyDayId"] });
  const { count } = await prisma.card.deleteMany({ where });
  let daysRemoved = 0;
  if (opts.removeEmptyDays) {
    const ids = affectedDays.map((d) => d.studyDayId!);
    if (ids.length) daysRemoved = (await prisma.studyDay.deleteMany({ where: { id: { in: ids }, cards: { none: {} } } })).count;
  }
  revalidatePath("/", "layout");
  return { count, daysRemoved };
}

/** How many cards a delete would remove (for the confirmation sheet). */
export async function countCardsForDelete(target: CardTarget) {
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  return prisma.card.count({ where: await resolveTarget(user.id, ctx, target) });
}

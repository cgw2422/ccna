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

export async function assignCardsToDay(cardIds: string[], dayId: string | null) {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const ids = z.array(z.string()).max(5000).parse(cardIds);
  if (dayId) {
    const day = await prisma.studyDay.findFirst({ where: { id: dayId, deckId: deck.id } });
    if (!day) throw new Error("Day not found");
  }
  const { count } = await prisma.card.updateMany({
    where: { id: { in: ids }, deckId: deck.id },
    data: { studyDayId: dayId, dayAssignedManually: true },
  });
  revalidatePath("/", "layout");
  return count;
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

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureDeck } from "@/lib/userSetup";
import { DAY_STATUSES } from "@/lib/ccna";

const statusSchema = z.enum(DAY_STATUSES);

async function ownedDayIds(userId: string, ids?: string[]) {
  const deck = await ensureDeck(prisma, userId);
  const days = await prisma.studyDay.findMany({
    where: { deckId: deck.id, ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, dayNumber: true },
  });
  return days;
}

async function writeStatuses(userId: string, entries: { dayId: string; status: z.infer<typeof statusSchema> }[]) {
  // Status changes only touch UserStudyDayState — card progress and review
  // history are never modified, so pausing is fully reversible.
  await prisma.$transaction(
    entries.map((e) =>
      prisma.userStudyDayState.upsert({
        where: { userId_studyDayId: { userId, studyDayId: e.dayId } },
        update: { status: e.status },
        create: { userId, studyDayId: e.dayId, status: e.status },
      }),
    ),
  );
  revalidatePath("/", "layout");
}

export async function setDayStatus(dayId: string, status: string) {
  const user = await requireUser();
  const s = statusSchema.parse(status);
  const days = await ownedDayIds(user.id, [dayId]);
  if (!days.length) throw new Error("Day not found");
  await writeStatuses(user.id, [{ dayId, status: s }]);
}

export async function setAllDayStatus(status: string) {
  const user = await requireUser();
  const s = statusSchema.parse(status);
  const days = await ownedDayIds(user.id);
  await writeStatuses(user.id, days.map((d) => ({ dayId: d.id, status: s })));
}

export async function setRangeDayStatus(from: number, to: number, status: string) {
  const user = await requireUser();
  const s = statusSchema.parse(status);
  const lo = Math.min(from, to), hi = Math.max(from, to);
  const days = (await ownedDayIds(user.id)).filter((d) => d.dayNumber >= lo && d.dayNumber <= hi);
  await writeStatuses(user.id, days.map((d) => ({ dayId: d.id, status: s })));
  return days.length;
}

/** Restore a previous snapshot (used by Undo). */
export async function applyDayStatuses(entries: { dayId: string; status: string }[]) {
  const user = await requireUser();
  const owned = new Set((await ownedDayIds(user.id, entries.map((e) => e.dayId))).map((d) => d.id));
  await writeStatuses(
    user.id,
    entries.filter((e) => owned.has(e.dayId)).map((e) => ({ dayId: e.dayId, status: statusSchema.parse(e.status) })),
  );
}

export async function setUnassignedStatus(status: string) {
  const user = await requireUser();
  const s = statusSchema.parse(status);
  await prisma.userSettings.upsert({ where: { userId: user.id }, update: { unassignedStatus: s }, create: { userId: user.id, unassignedStatus: s } });
  revalidatePath("/", "layout");
}

export async function updateDayDetails(dayId: string, data: { title: string; domainIds: number[] }) {
  const user = await requireUser();
  const days = await ownedDayIds(user.id, [dayId]);
  if (!days.length) throw new Error("Day not found");
  const title = z.string().trim().min(1).max(120).parse(data.title);
  const domainIds = z.array(z.number().int().min(1).max(6)).parse(data.domainIds);
  await prisma.$transaction([
    prisma.studyDay.update({ where: { id: dayId }, data: { title } }),
    prisma.studyDayDomain.deleteMany({ where: { studyDayId: dayId } }),
    prisma.studyDayDomain.createMany({ data: domainIds.map((domainId) => ({ studyDayId: dayId, domainId })) }),
  ]);
  revalidatePath("/", "layout");
}

export async function createStudyDay(dayNumber: number, title: string) {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const n = z.number().int().min(1).max(365).parse(dayNumber);
  const t = z.string().trim().min(1).max(120).parse(title);
  const day = await prisma.studyDay.upsert({
    where: { deckId_dayNumber: { deckId: deck.id, dayNumber: n } },
    update: {},
    create: { deckId: deck.id, dayNumber: n, title: t },
  });
  revalidatePath("/", "layout");
  return day.id;
}

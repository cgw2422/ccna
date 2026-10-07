"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createSession } from "@/lib/study/session";
import { getStudyContext, reviewCardFilter } from "@/lib/study/queue";
import { getWeakCardIds } from "@/lib/study/stats";
import { buildCustomCardIds, customStudySchema } from "@/lib/study/custom";

export async function startMainSession() {
  const user = await requireUser();
  // Reuse today's open main session so progress counts continue.
  const ctx = await getStudyContext(user.id);
  const open = await prisma.studySession.findFirst({
    where: { userId: user.id, type: "MAIN", completedAt: null, createdAt: { gte: ctx.dayStart } },
    orderBy: { createdAt: "desc" },
  });
  const session = open ?? (await createSession(user.id, "MAIN", { name: "Daily study" }));
  redirect(`/session/${session.id}`);
}

export async function startWeakSession(formData?: FormData) {
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const dayId = formData?.get("dayId");
  const weak = await getWeakCardIds(ctx, 30, typeof dayId === "string" && dayId ? [dayId] : undefined);
  if (weak.length === 0) redirect("/stats?weak=empty");
  const session = await createSession(user.id, "WEAK", { name: "Weak areas", cardIds: weak.map((w) => w.cardId) });
  redirect(`/session/${session.id}`);
}

export async function startCustomSession(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const raw = Object.fromEntries(formData.entries());
  const parsed = customStudySchema.safeParse({
    ...raw,
    dayIds: formData.getAll("dayIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await getStudyContext(user.id);
  const ids = await buildCustomCardIds(ctx, parsed.data);
  if (ids.length === 0) return { error: "No cards match those options." };
  const session = await createSession(user.id, "CUSTOM", {
    name: parsed.data.label || "Custom study",
    cardIds: ids,
    filters: parsed.data as unknown as object,
  });
  redirect(`/session/${session.id}`);
}

export async function startDaySession(formData: FormData) {
  const user = await requireUser();
  const dayId = z.string().parse(formData.get("dayId"));
  const ctx = await getStudyContext(user.id);
  const cards = await prisma.card.findMany({
    where: { ...reviewCardFilter({ ...ctx, reviewDayIds: [dayId], unassignedStatus: "PAUSED" }) },
    select: { id: true },
    orderBy: { sortIndex: "asc" },
    take: 200,
  });
  if (!cards.length) redirect(`/plan/${dayId}`);
  const session = await createSession(user.id, "CUSTOM", { name: "Day review", cardIds: cards.map((c) => c.id), filters: { dayIds: [dayId] } });
  redirect(`/session/${session.id}`);
}

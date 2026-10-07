"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureDeck, removeDemoData } from "@/lib/userSetup";
import { safeTimeZone } from "@/lib/time";

const schema = z.object({
  newCardsPerDay: z.coerce.number().int().min(0).max(9999),
  maxReviewsPerDay: z.string().trim().transform((v) => (v === "" ? null : Number(v))).pipe(z.number().int().min(0).max(99999).nullable()),
  autoShowAnswerSeconds: z.string().transform((v) => (v === "" || v === "0" ? null : Number(v))).pipe(z.number().int().min(1).max(120).nullable()),
  randomizeNewCards: z.preprocess((v) => v === "on", z.boolean()),
  desiredRetention: z.coerce.number().min(0.7).max(0.97),
  examDate: z.string().transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null)),
  timezone: z.string().min(1).max(64),
});

export async function saveSettings(_: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, timezone: safeTimeZone(parsed.data.timezone) };
  if (data.examDate && Number.isNaN(data.examDate.getTime())) return { error: "Invalid exam date" };
  await prisma.userSettings.upsert({ where: { userId: user.id }, update: data, create: { userId: user.id, ...data } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTheme(theme: "SYSTEM" | "LIGHT" | "DARK") {
  const user = await requireUser();
  const t = z.enum(["SYSTEM", "LIGHT", "DARK"]).parse(theme);
  await prisma.userSettings.upsert({ where: { userId: user.id }, update: { theme: t }, create: { userId: user.id, theme: t } });
  (await cookies()).set("theme", t.toLowerCase(), { path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
}

export async function removeDemoCards() {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const n = await removeDemoData(prisma, deck.id);
  revalidatePath("/", "layout");
  return n;
}

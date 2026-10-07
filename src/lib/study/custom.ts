import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { addDays } from "../time";
import type { StudyContext } from "./queue";
import { getWeakCardIds } from "./stats";

const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const customStudySchema = z.object({
  mode: z.enum(["days", "range", "domain", "weak", "missed", "due", "random"]),
  dayIds: z.array(z.string()).default([]),
  fromDay: z.coerce.number().int().min(0).max(999).optional(),
  toDay: z.coerce.number().int().min(0).max(999).optional(),
  domainId: z.coerce.number().int().optional(),
  missedDays: z.coerce.number().int().min(1).max(365).default(7),
  aheadDays: z.coerce.number().int().min(0).max(60).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  includeNew: bool.default(false),
  includePaused: bool.default(false),
  label: z.string().max(60).optional(),
});

export type CustomStudyInput = z.infer<typeof customStudySchema>;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build the card list for a temporary custom session. Never changes the Study
 * Plan; paused days are excluded unless explicitly included.
 */
export async function buildCustomCardIds(ctx: StudyContext, input: CustomStudyInput): Promise<string[]> {
  const allowedDays = input.includePaused ? null : ctx.reviewDayIds;
  const dayScope = async (): Promise<string[] | null> => {
    if (input.mode === "days") return input.dayIds;
    if (input.mode === "range") {
      const from = Math.min(input.fromDay ?? 1, input.toDay ?? 999);
      const to = Math.max(input.fromDay ?? 1, input.toDay ?? 999);
      const days = await prisma.studyDay.findMany({
        where: { deckId: { in: ctx.deckIds }, dayNumber: { gte: from, lte: to } },
        select: { id: true },
      });
      return days.map((d) => d.id);
    }
    if (input.mode === "domain") {
      const days = await prisma.studyDay.findMany({
        where: { deckId: { in: ctx.deckIds }, domains: { some: { domainId: input.domainId } } },
        select: { id: true },
      });
      return days.map((d) => d.id);
    }
    return null;
  };

  const scope = await dayScope();
  let dayFilter: Prisma.CardWhereInput;
  if (scope) {
    const ids = allowedDays ? scope.filter((id) => allowedDays.includes(id)) : scope;
    dayFilter = { studyDayId: { in: ids } };
  } else if (allowedDays) {
    dayFilter = ctx.unassignedStatus !== "PAUSED" ? { OR: [{ studyDayId: { in: allowedDays } }, { studyDayId: null }] } : { studyDayId: { in: allowedDays } };
  } else dayFilter = {};
  const base: Prisma.CardWhereInput = { deckId: { in: ctx.deckIds }, ...dayFilter };
  const seenOnly: Prisma.CardWhereInput = { progress: { some: { userId: ctx.userId } } };

  switch (input.mode) {
    case "weak": {
      const weak = await getWeakCardIds(ctx, input.limit);
      if (!input.includePaused) return weak.map((w) => w.cardId);
      // getWeakCardIds already excludes paused days; with includePaused widen the search.
      const rows = await prisma.userCardProgress.findMany({
        where: { userId: ctx.userId, OR: [{ againCount: { gt: 0 } }, { hardCount: { gt: 0 } }], card: base },
        orderBy: [{ againCount: "desc" }, { lapses: "desc" }],
        take: input.limit,
        select: { cardId: true },
      });
      return rows.map((r) => r.cardId);
    }
    case "missed": {
      const reviews = await prisma.review.findMany({
        where: { userId: ctx.userId, rating: 1, reviewedAt: { gte: addDays(ctx.now, -input.missedDays) }, card: base },
        orderBy: { reviewedAt: "desc" },
        select: { cardId: true },
        distinct: ["cardId"],
        take: input.limit,
      });
      return reviews.map((r) => r.cardId);
    }
    case "due": {
      const until = addDays(ctx.dayEnd, input.aheadDays);
      const rows = await prisma.userCardProgress.findMany({
        where: { userId: ctx.userId, state: { not: "NEW" }, due: { lte: until }, card: base },
        orderBy: { due: "asc" },
        take: input.limit,
        select: { cardId: true },
      });
      return rows.map((r) => r.cardId);
    }
    case "random": {
      const rows = await prisma.card.findMany({ where: input.includeNew ? base : { ...base, ...seenOnly }, select: { id: true } });
      return shuffle(rows.map((r) => r.id)).slice(0, input.limit);
    }
    default: {
      const rows = await prisma.card.findMany({
        where: input.includeNew ? base : { ...base, ...seenOnly },
        select: { id: true, progress: { where: { userId: ctx.userId }, select: { due: true } } },
        orderBy: [{ studyDay: { dayNumber: "asc" } }, { sortIndex: "asc" }],
      });
      // Seen cards that are most overdue first, then unseen cards in course order.
      const seen = rows.filter((r) => r.progress.length).sort((a, b) => a.progress[0].due.getTime() - b.progress[0].due.getTime());
      const unseen = rows.filter((r) => !r.progress.length);
      return [...seen, ...unseen].slice(0, input.limit).map((r) => r.id);
    }
  }
}

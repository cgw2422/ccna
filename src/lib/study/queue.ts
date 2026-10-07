import { Prisma, type DayStatus } from "@prisma/client";
import { prisma } from "../db";
import { getSettings, type Settings } from "../settings";
import { endOfLocalDay, localDateKey, startOfLocalDay } from "../time";
import { ensureDeck } from "../userSetup";

/** Learning cards due within this window are shown early when nothing else is left. */
export const LEARN_AHEAD_MS = 20 * 60_000;

export type StudyContext = {
  userId: string;
  deckIds: string[];
  settings: Settings;
  now: Date;
  dayStart: Date;
  dayEnd: Date;
  /** Days whose due reviews may appear (ACTIVE + REVIEW_ONLY). */
  reviewDayIds: string[];
  /** Days that may introduce new cards (ACTIVE only). */
  newDayIds: string[];
  unassignedStatus: DayStatus;
};

/**
 * Resolve the user's Study Plan into the sets of study days that may supply
 * reviews and new cards. Called on every request, so a day status change
 * takes effect immediately.
 */
export async function getStudyContext(userId: string, now = new Date()): Promise<StudyContext> {
  const settings = await getSettings(userId);
  const deck = await ensureDeck(prisma, userId);
  const deckIds = [deck.id];
  const days = await prisma.studyDay.findMany({
    where: { deckId: { in: deckIds } },
    select: { id: true, userStates: { where: { userId }, select: { status: true } } },
  });
  const reviewDayIds: string[] = [];
  const newDayIds: string[] = [];
  for (const d of days) {
    const status = d.userStates[0]?.status ?? "ACTIVE";
    if (status === "ACTIVE") {
      reviewDayIds.push(d.id);
      newDayIds.push(d.id);
    } else if (status === "REVIEW_ONLY") reviewDayIds.push(d.id);
  }
  return {
    userId,
    deckIds,
    settings,
    now,
    dayStart: startOfLocalDay(now, settings.timezone),
    dayEnd: endOfLocalDay(now, settings.timezone),
    reviewDayIds,
    newDayIds,
    unassignedStatus: settings.unassignedStatus,
  };
}

export function reviewCardFilter(ctx: StudyContext): Prisma.CardWhereInput {
  const or: Prisma.CardWhereInput[] = [{ studyDayId: { in: ctx.reviewDayIds } }];
  if (ctx.unassignedStatus !== "PAUSED") or.push({ studyDayId: null });
  return { deckId: { in: ctx.deckIds }, OR: or };
}

export function newCardFilter(ctx: StudyContext): Prisma.CardWhereInput {
  const or: Prisma.CardWhereInput[] = [{ studyDayId: { in: ctx.newDayIds } }];
  if (ctx.unassignedStatus === "ACTIVE") or.push({ studyDayId: null });
  return { deckId: { in: ctx.deckIds }, OR: or, progress: { none: { userId: ctx.userId } } };
}

/** Cards that are not paused at all (used by weak-area sessions). */
export function notPausedCardFilter(ctx: StudyContext): Prisma.CardWhereInput {
  return reviewCardFilter(ctx);
}

export async function getTodayCounts(ctx: StudyContext) {
  const [newDoneToday, reviewsDoneToday] = await Promise.all([
    prisma.review.count({ where: { userId: ctx.userId, reviewedAt: { gte: ctx.dayStart }, stateBefore: "NEW" } }),
    prisma.review.count({ where: { userId: ctx.userId, reviewedAt: { gte: ctx.dayStart }, stateBefore: "REVIEW" } }),
  ]);
  const newLimitLeft = Math.max(0, ctx.settings.newCardsPerDay - newDoneToday);
  const reviewLimitLeft =
    ctx.settings.maxReviewsPerDay == null ? Number.POSITIVE_INFINITY : Math.max(0, ctx.settings.maxReviewsPerDay - reviewsDoneToday);
  return { newDoneToday, reviewsDoneToday, newLimitLeft, reviewLimitLeft };
}

export type DueCounts = { new: number; learning: number; review: number; total: number; learningNow: number };

export async function getDueCounts(ctx: StudyContext): Promise<DueCounts> {
  const limits = await getTodayCounts(ctx);
  const reviewFilter = reviewCardFilter(ctx);
  const [learning, learningNow, review, newAvailable] = await Promise.all([
    prisma.userCardProgress.count({
      where: { userId: ctx.userId, state: { in: ["LEARNING", "RELEARNING"] }, due: { lte: ctx.dayEnd }, card: reviewFilter },
    }),
    prisma.userCardProgress.count({
      where: {
        userId: ctx.userId,
        state: { in: ["LEARNING", "RELEARNING"] },
        due: { lte: new Date(ctx.now.getTime() + LEARN_AHEAD_MS) },
        card: reviewFilter,
      },
    }),
    prisma.userCardProgress.count({ where: { userId: ctx.userId, state: "REVIEW", due: { lte: ctx.dayEnd }, card: reviewFilter } }),
    limits.newLimitLeft > 0 ? prisma.card.count({ where: newCardFilter(ctx) }) : Promise.resolve(0),
  ]);
  const reviewCount = Math.min(review, limits.reviewLimitLeft);
  const newCount = Math.min(newAvailable, limits.newLimitLeft);
  return { new: newCount, learning, review: reviewCount, total: newCount + learning + reviewCount, learningNow };
}

export type QueueKind = "learning" | "review" | "new";

/**
 * Pick the next card for the main study session.
 * Order: learning cards due now → due reviews → new cards (within the daily
 * limits) → learning cards due soon (learn-ahead).
 */
export async function nextMainCard(
  ctx: StudyContext,
  excludeCardId?: string | null,
): Promise<{ cardId: string; kind: QueueKind } | { cardId: null; nextDue: Date | null }> {
  const reviewFilter = reviewCardFilter(ctx);
  const exclude = excludeCardId ? { not: excludeCardId } : undefined;
  const limits = await getTodayCounts(ctx);

  const learningNow = await prisma.userCardProgress.findFirst({
    where: { userId: ctx.userId, state: { in: ["LEARNING", "RELEARNING"] }, due: { lte: ctx.now }, cardId: exclude, card: reviewFilter },
    orderBy: { due: "asc" },
    select: { cardId: true },
  });
  if (learningNow) return { cardId: learningNow.cardId, kind: "learning" };

  if (limits.reviewLimitLeft > 0) {
    const review = await prisma.userCardProgress.findFirst({
      where: { userId: ctx.userId, state: "REVIEW", due: { lte: ctx.dayEnd }, cardId: exclude, card: reviewFilter },
      orderBy: { due: "asc" },
      select: { cardId: true },
    });
    if (review) return { cardId: review.cardId, kind: "review" };
  }

  if (limits.newLimitLeft > 0) {
    const id = await pickNewCard(ctx, excludeCardId ?? null);
    if (id) return { cardId: id, kind: "new" };
  }

  const ahead = await prisma.userCardProgress.findFirst({
    where: {
      userId: ctx.userId,
      state: { in: ["LEARNING", "RELEARNING"] },
      due: { lte: new Date(ctx.now.getTime() + LEARN_AHEAD_MS) },
      card: reviewFilter,
    },
    orderBy: [{ due: "asc" }],
    select: { cardId: true },
  });
  if (ahead) {
    // Prefer something other than the card just answered, but allow it if it's the only one.
    if (ahead.cardId !== excludeCardId) return { cardId: ahead.cardId, kind: "learning" };
    const other = await prisma.userCardProgress.findFirst({
      where: {
        userId: ctx.userId,
        state: { in: ["LEARNING", "RELEARNING"] },
        due: { lte: new Date(ctx.now.getTime() + LEARN_AHEAD_MS) },
        cardId: exclude,
        card: reviewFilter,
      },
      orderBy: { due: "asc" },
      select: { cardId: true },
    });
    return { cardId: (other ?? ahead).cardId, kind: "learning" };
  }

  if (excludeCardId) {
    // The excluded card itself might be the only due card left.
    const again = await nextMainCard(ctx, null);
    if (again.cardId) return again;
  }

  const later = await prisma.userCardProgress.findFirst({
    where: { userId: ctx.userId, state: { in: ["LEARNING", "RELEARNING"] }, due: { lte: ctx.dayEnd }, card: reviewFilter },
    orderBy: { due: "asc" },
    select: { due: true },
  });
  return { cardId: null, nextDue: later?.due ?? null };
}

async function pickNewCard(ctx: StudyContext, excludeCardId: string | null): Promise<string | null> {
  const includeUnassigned = ctx.unassignedStatus === "ACTIVE";
  if (ctx.newDayIds.length === 0 && !includeUnassigned) return null;
  const seed = localDateKey(ctx.now, ctx.settings.timezone);
  const randomOrder = ctx.settings.randomizeNewCards;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM "Card" c
    LEFT JOIN "StudyDay" d ON d.id = c."studyDayId"
    WHERE c."deckId" = ANY(${ctx.deckIds})
      AND (c."studyDayId" = ANY(${ctx.newDayIds.length ? ctx.newDayIds : ["-"]}) OR (${includeUnassigned} AND c."studyDayId" IS NULL))
      AND NOT EXISTS (SELECT 1 FROM "UserCardProgress" p WHERE p."cardId" = c.id AND p."userId" = ${ctx.userId})
      AND c.id <> ${excludeCardId ?? ""}
    ORDER BY
      CASE WHEN ${randomOrder} THEN md5(c.id || ${seed}) ELSE NULL END,
      d."dayNumber" ASC NULLS LAST, c."sortIndex" ASC, c.id ASC
    LIMIT 1`;
  return rows[0]?.id ?? null;
}

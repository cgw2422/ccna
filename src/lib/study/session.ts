import type { Prisma, SessionType } from "@prisma/client";
import { prisma } from "../db";
import { formatCardHtml } from "../content/format";
import { formatInterval } from "../time";
import { previewIntervals, schedule, type ProgressFields, type RatingValue } from "./fsrs";
import { getDueCounts, getStudyContext, nextMainCard, type QueueKind, type StudyContext } from "./queue";

export type StudyCardPayload = {
  id: string;
  front: string;
  back: string;
  dayLabel: string;
  kind: QueueKind;
  intervals: Record<RatingValue, string>;
};

export type SessionState =
  | { status: "card"; sessionId: string; card: StudyCardPayload; done: number; remaining: number; canUndo: boolean }
  | { status: "waiting"; sessionId: string; nextDue: string; done: number; canUndo: boolean }
  | { status: "finished"; sessionId: string; done: number; canUndo: boolean };

export async function createSession(
  userId: string,
  type: SessionType,
  opts: { name?: string; filters?: Prisma.InputJsonValue; cardIds?: string[] } = {},
) {
  return prisma.studySession.create({
    data: {
      userId,
      type,
      name: opts.name,
      filters: opts.filters,
      cards: opts.cardIds ? { create: opts.cardIds.map((cardId, position) => ({ cardId, position })) } : undefined,
    },
  });
}

async function loadSession(userId: string, sessionId: string) {
  const s = await prisma.studySession.findFirst({ where: { id: sessionId, userId } });
  if (!s) throw new HttpError(404, "Session not found");
  return s;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function dayLabel(day: { dayNumber: number; title: string } | null): string {
  return day ? `Day ${day.dayNumber} • ${day.title}` : "Unassigned";
}

async function buildCardPayload(ctx: StudyContext, cardId: string, kind: QueueKind): Promise<StudyCardPayload> {
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: {
      studyDay: { select: { dayNumber: true, title: true } },
      progress: { where: { userId: ctx.userId } },
    },
  });
  const p = card.progress[0] ?? null;
  const iv = previewIntervals(p, ctx.now, ctx.settings.desiredRetention);
  return {
    id: card.id,
    front: formatCardHtml(card.front, "front"),
    back: formatCardHtml(card.back, "back") + (card.extra ? `<hr>${formatCardHtml(card.extra, "back")}` : ""),
    dayLabel: dayLabel(card.studyDay),
    kind: p ? (p.state === "REVIEW" ? "review" : "learning") : kind,
    intervals: { 1: formatInterval(iv[1]), 2: formatInterval(iv[2]), 3: formatInterval(iv[3]), 4: formatInterval(iv[4]) },
  };
}

export async function getSessionState(userId: string, sessionId: string, excludeCardId?: string | null): Promise<SessionState> {
  const session = await loadSession(userId, sessionId);
  const ctx = await getStudyContext(userId);
  const done = await prisma.review.count({ where: { sessionId } });
  const canUndo = done > 0;

  if (session.type === "MAIN") {
    const next = await nextMainCard(ctx, excludeCardId);
    if (next.cardId !== null) {
      const counts = await getDueCounts(ctx);
      const card = await buildCardPayload(ctx, next.cardId, next.kind);
      const remaining = Math.max(1, counts.new + counts.review + counts.learningNow);
      return { status: "card", sessionId, card, done, remaining, canUndo };
    }
    if ("nextDue" in next && next.nextDue) return { status: "waiting", sessionId, nextDue: next.nextDue.toISOString(), done, canUndo };
    await markFinished(sessionId);
    return { status: "finished", sessionId, done, canUndo };
  }

  // Fixed-list sessions (weak areas / custom study).
  const pendingWhere = { sessionId, status: "PENDING" as const };
  let entry = await prisma.studySessionCard.findFirst({
    where: { ...pendingWhere, cardId: excludeCardId ? { not: excludeCardId } : undefined },
    orderBy: { position: "asc" },
  });
  if (!entry && excludeCardId) entry = await prisma.studySessionCard.findFirst({ where: pendingWhere, orderBy: { position: "asc" } });
  if (!entry) {
    await markFinished(sessionId);
    return { status: "finished", sessionId, done, canUndo };
  }
  const remaining = await prisma.studySessionCard.count({ where: pendingWhere });
  const card = await buildCardPayload(ctx, entry.cardId, "new");
  return { status: "card", sessionId, card, done, remaining, canUndo };
}

async function markFinished(sessionId: string) {
  await prisma.studySession.updateMany({ where: { id: sessionId, completedAt: null }, data: { completedAt: new Date() } });
}

export async function answerCard(input: { userId: string; sessionId: string; cardId: string; rating: RatingValue; durationMs?: number }) {
  const { userId, sessionId, cardId, rating } = input;
  const session = await loadSession(userId, sessionId);
  const card = await prisma.card.findFirst({ where: { id: cardId, deck: { ownerId: userId } }, select: { id: true } });
  if (!card) throw new HttpError(404, "Card not found");
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const prev = await tx.userCardProgress.findUnique({ where: { userId_cardId: { userId, cardId } } });
    const prevFields: ProgressFields | null = prev;
    const { next, log } = schedule(prevFields, rating, now, settings?.desiredRetention ?? 0.9);
    const counters = {
      againCount: (prev?.againCount ?? 0) + (rating === 1 ? 1 : 0),
      hardCount: (prev?.hardCount ?? 0) + (rating === 2 ? 1 : 0),
    };
    await tx.userCardProgress.upsert({
      where: { userId_cardId: { userId, cardId } },
      update: { ...next, ...counters },
      create: { userId, cardId, ...next, ...counters },
    });
    await tx.review.create({
      data: {
        userId,
        cardId,
        sessionId,
        rating,
        stateBefore: prev?.state ?? "NEW",
        stateAfter: next.state,
        dueAfter: next.due,
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: Math.round(log.elapsed_days),
        scheduledDays: next.scheduledDays,
        durationMs: input.durationMs ? Math.min(Math.max(0, Math.round(input.durationMs)), 3_600_000) : null,
        reviewedAt: now,
        prevProgress: prev ? (JSON.parse(JSON.stringify(prev)) as Prisma.InputJsonValue) : undefined,
      },
    });
    if (session.type !== "MAIN") {
      const entry = await tx.studySessionCard.findUnique({ where: { sessionId_cardId: { sessionId, cardId } } });
      if (entry) {
        if (rating === 1) {
          // Missed cards come back at the end of a temporary session.
          const last = await tx.studySessionCard.aggregate({ where: { sessionId }, _max: { position: true } });
          await tx.studySessionCard.update({
            where: { id: entry.id },
            data: { position: (last._max.position ?? 0) + 1, lastRating: rating, answeredAt: now },
          });
        } else {
          await tx.studySessionCard.update({ where: { id: entry.id }, data: { status: "DONE", lastRating: rating, answeredAt: now } });
        }
      }
    }
  });
  return getSessionState(userId, sessionId, cardId);
}

/** Undo the most recent answer in a session, restoring the previous schedule. */
export async function undoLastAnswer(userId: string, sessionId: string) {
  const session = await loadSession(userId, sessionId);
  const last = await prisma.review.findFirst({ where: { userId, sessionId }, orderBy: { reviewedAt: "desc" } });
  if (!last) return getSessionState(userId, sessionId);
  await prisma.$transaction(async (tx) => {
    const prev = last.prevProgress as (ProgressFields & { againCount: number; hardCount: number; due: string; lastReview: string | null }) | null;
    if (prev) {
      await tx.userCardProgress.update({
        where: { userId_cardId: { userId, cardId: last.cardId } },
        data: {
          state: prev.state,
          due: new Date(prev.due),
          stability: prev.stability,
          difficulty: prev.difficulty,
          elapsedDays: prev.elapsedDays,
          scheduledDays: prev.scheduledDays,
          learningSteps: prev.learningSteps,
          reps: prev.reps,
          lapses: prev.lapses,
          lastReview: prev.lastReview ? new Date(prev.lastReview) : null,
          againCount: prev.againCount,
          hardCount: prev.hardCount,
        },
      });
    } else {
      await tx.userCardProgress.deleteMany({ where: { userId, cardId: last.cardId } });
    }
    await tx.review.delete({ where: { id: last.id } });
    if (session.type !== "MAIN") {
      await tx.studySessionCard.updateMany({
        where: { sessionId, cardId: last.cardId },
        data: { status: "PENDING", position: -1, lastRating: null, answeredAt: null },
      });
    }
    await tx.studySession.update({ where: { id: sessionId }, data: { completedAt: null } });
  });
  // Show the undone card again immediately.
  const ctx = await getStudyContext(userId);
  const done = await prisma.review.count({ where: { sessionId } });
  const card = await buildCardPayload(ctx, last.cardId, last.stateBefore === "NEW" ? "new" : "review");
  const counts = session.type === "MAIN" ? await getDueCounts(ctx) : null;
  const remaining = counts
    ? Math.max(1, counts.new + counts.review + counts.learningNow)
    : await prisma.studySessionCard.count({ where: { sessionId, status: "PENDING" } });
  return { status: "card", sessionId, card, done, remaining, canUndo: done > 0 } satisfies SessionState;
}

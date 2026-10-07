import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { addDays, localDateKey } from "../time";
import type { StudyContext } from "./queue";

export type DayAggregate = {
  dayId: string | null;
  total: number;
  seen: number;
  learned: number;
  learning: number;
  masterySum: number;
  dueReviews: number;
};

/** Per-study-day card/progress aggregates for the user (one SQL round trip). */
export async function getDayAggregates(ctx: StudyContext): Promise<Map<string | null, DayAggregate>> {
  const rows = await prisma.$queryRaw<DayAggregate[]>`
    SELECT c."studyDayId" AS "dayId",
      count(*)::int AS total,
      count(p.id)::int AS seen,
      (count(*) FILTER (WHERE p.state = 'REVIEW'))::int AS learned,
      (count(*) FILTER (WHERE p.state IN ('LEARNING','RELEARNING')))::int AS learning,
      coalesce(sum(CASE WHEN p.state IS NULL THEN 0
                        WHEN p.state IN ('LEARNING','RELEARNING') THEN 0.2
                        ELSE LEAST(1, 0.4 + 0.6 * p.stability / 21) END), 0)::float AS "masterySum",
      (count(*) FILTER (WHERE p.state = 'REVIEW' AND p.due <= ${ctx.dayEnd}))::int AS "dueReviews"
    FROM "Card" c
    LEFT JOIN "UserCardProgress" p ON p."cardId" = c.id AND p."userId" = ${ctx.userId}
    WHERE c."deckId" = ANY(${ctx.deckIds})
    GROUP BY c."studyDayId"`;
  return new Map(rows.map((r) => [r.dayId, r]));
}

export type ReviewAggregate = { dayId: string | null; total: number; correct: number; again: number; hard: number };

export async function getReviewAggregatesByDay(ctx: StudyContext, sinceDays?: number): Promise<Map<string | null, ReviewAggregate>> {
  const since = sinceDays ? addDays(ctx.now, -sinceDays) : new Date(0);
  const rows = await prisma.$queryRaw<ReviewAggregate[]>`
    SELECT c."studyDayId" AS "dayId",
      count(*)::int AS total,
      (count(*) FILTER (WHERE r.rating > 1))::int AS correct,
      (count(*) FILTER (WHERE r.rating = 1))::int AS again,
      (count(*) FILTER (WHERE r.rating = 2))::int AS hard
    FROM "Review" r JOIN "Card" c ON c.id = r."cardId"
    WHERE r."userId" = ${ctx.userId} AND r."reviewedAt" >= ${since} AND c."deckId" = ANY(${ctx.deckIds})
    GROUP BY c."studyDayId"`;
  return new Map(rows.map((r) => [r.dayId, r]));
}

export async function getStreak(ctx: StudyContext): Promise<number> {
  const tz = ctx.settings.timezone;
  const rows = await prisma.$queryRaw<{ d: string }[]>`
    SELECT DISTINCT to_char(("reviewedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d
    FROM "Review" WHERE "userId" = ${ctx.userId} AND "reviewedAt" >= ${addDays(ctx.now, -800)}
    ORDER BY d DESC`;
  const days = new Set(rows.map((r) => r.d));
  let cursor = ctx.now;
  if (!days.has(localDateKey(cursor, tz))) cursor = addDays(cursor, -1); // today not studied yet: streak still alive
  let streak = 0;
  while (days.has(localDateKey(cursor, tz))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function getOverview(ctx: StudyContext) {
  const weekStart = addDays(ctx.dayStart, -6);
  const [aggs, reviewsToday, reviewsWeek, acc, streak] = await Promise.all([
    getDayAggregates(ctx),
    prisma.review.count({ where: { userId: ctx.userId, reviewedAt: { gte: ctx.dayStart } } }),
    prisma.review.count({ where: { userId: ctx.userId, reviewedAt: { gte: weekStart } } }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { userId: ctx.userId, reviewedAt: { gte: addDays(ctx.now, -30) } },
      _count: { _all: true },
    }),
    getStreak(ctx),
  ]);
  let total = 0, seen = 0, learned = 0, learning = 0, masterySum = 0;
  for (const a of aggs.values()) {
    total += a.total;
    seen += a.seen;
    learned += a.learned;
    learning += a.learning;
    masterySum += a.masterySum;
  }
  const accTotal = acc.reduce((s, r) => s + r._count._all, 0);
  const accCorrect = acc.filter((r) => r.rating > 1).reduce((s, r) => s + r._count._all, 0);
  return {
    totalCards: total,
    seen,
    unseen: total - seen,
    learned,
    learning,
    remaining: total - learned,
    mastery: total ? Math.round((masterySum / total) * 100) : 0,
    reviewsToday,
    reviewsWeek,
    accuracy: accTotal ? Math.round((accCorrect / accTotal) * 100) : null,
    accuracySample: accTotal,
    streak,
  };
}

export async function getPlanSummary(userId: string, deckIds: string[]) {
  const days = await prisma.studyDay.findMany({
    where: { deckId: { in: deckIds } },
    select: { userStates: { where: { userId }, select: { status: true } } },
  });
  const summary = { ACTIVE: 0, REVIEW_ONLY: 0, PAUSED: 0, total: days.length };
  for (const d of days) summary[d.userStates[0]?.status ?? "ACTIVE"]++;
  return summary;
}

export type DayStatRow = {
  id: string;
  dayNumber: number;
  title: string;
  status: "ACTIVE" | "REVIEW_ONLY" | "PAUSED";
  domainIds: number[];
  total: number;
  seen: number;
  learned: number;
  mastery: number;
  accuracy: number | null;
  reviews: number;
  againRate: number | null;
};

export async function getDayStats(ctx: StudyContext): Promise<DayStatRow[]> {
  const [days, aggs, revs] = await Promise.all([
    prisma.studyDay.findMany({
      where: { deckId: { in: ctx.deckIds } },
      orderBy: { dayNumber: "asc" },
      select: {
        id: true,
        dayNumber: true,
        title: true,
        domains: { select: { domainId: true } },
        userStates: { where: { userId: ctx.userId }, select: { status: true } },
      },
    }),
    getDayAggregates(ctx),
    getReviewAggregatesByDay(ctx),
  ]);
  return days.map((d) => {
    const a = aggs.get(d.id);
    const r = revs.get(d.id);
    return {
      id: d.id,
      dayNumber: d.dayNumber,
      title: d.title,
      status: d.userStates[0]?.status ?? "ACTIVE",
      domainIds: d.domains.map((x) => x.domainId),
      total: a?.total ?? 0,
      seen: a?.seen ?? 0,
      learned: a?.learned ?? 0,
      mastery: a && a.total ? Math.round((a.masterySum / a.total) * 100) : 0,
      accuracy: r && r.total ? Math.round((r.correct / r.total) * 100) : null,
      reviews: r?.total ?? 0,
      againRate: r && r.total ? (r.again + r.hard) / r.total : null,
    };
  });
}

export async function getDomainStats(ctx: StudyContext, dayStats?: DayStatRow[]) {
  const days = dayStats ?? (await getDayStats(ctx));
  const domains = await prisma.ccnaDomain.findMany({ orderBy: { sortOrder: "asc" } });
  const revs = await getReviewAggregatesByDay(ctx);
  const aggs = await getDayAggregates(ctx);
  return domains.map((dom) => {
    const inDomain = days.filter((d) => d.domainIds.includes(dom.id));
    let total = 0, masterySum = 0, revTotal = 0, revCorrect = 0, learned = 0;
    for (const d of inDomain) {
      const a = aggs.get(d.id);
      const r = revs.get(d.id);
      total += a?.total ?? 0;
      masterySum += a?.masterySum ?? 0;
      learned += a?.learned ?? 0;
      revTotal += r?.total ?? 0;
      revCorrect += r?.correct ?? 0;
    }
    return {
      id: dom.id,
      name: dom.name,
      examWeight: dom.examWeight,
      dayCount: inDomain.length,
      cards: total,
      learned,
      mastery: total ? Math.round((masterySum / total) * 100) : null,
      accuracy: revTotal ? Math.round((revCorrect / revTotal) * 100) : null,
    };
  });
}

/**
 * Weak cards: cards frequently rated Again/Hard, scored by
 * (2·again + hard) / reps + 0.15·lapses. Paused study days are excluded.
 */
export async function getWeakCardIds(ctx: StudyContext, limit = 40, dayIds?: string[]): Promise<{ cardId: string; score: number }[]> {
  const allowed = dayIds ? ctx.reviewDayIds.filter((id) => dayIds.includes(id)) : ctx.reviewDayIds;
  const includeUnassigned = !dayIds && ctx.unassignedStatus !== "PAUSED";
  return prisma.$queryRaw<{ cardId: string; score: number }[]>`
    SELECT p."cardId",
      ((2 * p."againCount" + p."hardCount")::float / GREATEST(p.reps, 1) + 0.15 * p.lapses)::float AS score
    FROM "UserCardProgress" p JOIN "Card" c ON c.id = p."cardId"
    WHERE p."userId" = ${ctx.userId}
      AND c."deckId" = ANY(${ctx.deckIds})
      AND (p."againCount" + p."hardCount") > 0
      AND (c."studyDayId" = ANY(${allowed.length ? allowed : ["-"]}) OR (${includeUnassigned} AND c."studyDayId" IS NULL))
    ORDER BY score DESC, p."lastReview" DESC NULLS LAST
    LIMIT ${limit}`;
}

export async function countWeakCards(ctx: StudyContext): Promise<number> {
  const rows = await getWeakCardIds(ctx, 100000);
  return rows.filter((r) => r.score >= 0.3).length;
}

export async function getRecentActivity(ctx: StudyContext, days = 14) {
  const tz = ctx.settings.timezone;
  const since = addDays(ctx.dayStart, -(days - 1));
  const rows = await prisma.$queryRaw<{ d: string; n: number }[]>(Prisma.sql`
    SELECT to_char(("reviewedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d, count(*)::int AS n
    FROM "Review" WHERE "userId" = ${ctx.userId} AND "reviewedAt" >= ${since}
    GROUP BY 1`);
  const map = new Map(rows.map((r) => [r.d, r.n]));
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = localDateKey(addDays(ctx.now, -i), tz);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

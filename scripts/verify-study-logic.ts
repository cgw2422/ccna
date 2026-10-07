// Integration check for Study Plan rules against a real database.
//   npx tsx scripts/verify-study-logic.ts
// Creates a throwaway user, exercises ACTIVE / REVIEW_ONLY / PAUSED, then deletes the user.
import { PrismaClient } from "@prisma/client";
import { createUserWithDefaults, ensureDeck } from "../src/lib/userSetup";
import { getDueCounts, getStudyContext, nextMainCard } from "../src/lib/study/queue";
import { schedule } from "../src/lib/study/fsrs";

const db = new PrismaClient();
let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failures++;
}

async function setStatus(userId: string, dayId: string, status: "ACTIVE" | "REVIEW_ONLY" | "PAUSED") {
  await db.userStudyDayState.upsert({
    where: { userId_studyDayId: { userId, studyDayId: dayId } },
    update: { status },
    create: { userId, studyDayId: dayId, status },
  });
}

async function main() {
  const user = await createUserWithDefaults(db, { email: `verify-${Date.now()}@test.local`, passwordHash: "x" });
  try {
    const deck = await ensureDeck(db, user.id);
    const days = await db.studyDay.findMany({ where: { deckId: deck.id }, orderBy: { dayNumber: "asc" } });
    const [d1, d2, d3] = days;
    for (const d of days) await setStatus(user.id, d.id, "PAUSED");
    await setStatus(user.id, d3.id, "ACTIVE");

    let ctx = await getStudyContext(user.id);
    let next = await nextMainCard(ctx);
    const card = next.cardId ? await db.card.findUnique({ where: { id: next.cardId } }) : null;
    check("only ACTIVE day supplies new cards", card?.studyDayId === d3.id);

    // Study one Day 1 card in the past so it is a due review, then pause Day 1.
    const d1card = await db.card.findFirstOrThrow({ where: { studyDayId: d1.id } });
    const past = new Date(Date.now() - 30 * 86400000);
    let p = schedule(null, 3, past, 0.9).next;
    p = schedule(p, 3, new Date(past.getTime() + 600000), 0.9).next;
    await db.userCardProgress.create({ data: { userId: user.id, cardId: d1card.id, ...p, due: new Date(Date.now() - 86400000) } });
    await db.review.create({ data: { userId: user.id, cardId: d1card.id, rating: 3, stateBefore: "NEW", stateAfter: p.state, dueAfter: p.due, stability: p.stability, difficulty: p.difficulty, elapsedDays: 0, scheduledDays: p.scheduledDays, reviewedAt: past } });

    ctx = await getStudyContext(user.id);
    let counts = await getDueCounts(ctx);
    check("PAUSED day: due review hidden", counts.review === 0);

    await setStatus(user.id, d1.id, "REVIEW_ONLY");
    ctx = await getStudyContext(user.id);
    counts = await getDueCounts(ctx);
    next = await nextMainCard(ctx);
    check("REVIEW_ONLY day: due review appears", counts.review === 1 && next.cardId === d1card.id);
    const d1New = await db.card.count({ where: { studyDayId: d1.id, progress: { none: { userId: user.id } } } });
    const d3New = await db.card.count({ where: { studyDayId: d3.id } });
    check("REVIEW_ONLY day: no new cards counted", counts.new === Math.min(30, d3New) && d1New > 0);

    await setStatus(user.id, d1.id, "PAUSED");
    await setStatus(user.id, d3.id, "PAUSED");
    ctx = await getStudyContext(user.id);
    counts = await getDueCounts(ctx);
    next = await nextMainCard(ctx);
    check("all PAUSED: nothing to study", counts.total === 0 && next.cardId === null);
    const kept = await db.userCardProgress.findUnique({ where: { userId_cardId: { userId: user.id, cardId: d1card.id } } });
    const history = await db.review.count({ where: { userId: user.id, cardId: d1card.id } });
    check("pausing preserves progress + history", !!kept && kept.reps === 2 && history === 1);

    await setStatus(user.id, d1.id, "ACTIVE");
    ctx = await getStudyContext(user.id);
    counts = await getDueCounts(ctx);
    check("re-activating restores due review + new cards", counts.review === 1 && counts.new > 0);

    await db.userSettings.update({ where: { userId: user.id }, data: { newCardsPerDay: 2 } });
    ctx = await getStudyContext(user.id);
    counts = await getDueCounts(ctx);
    check("daily new-card limit respected", counts.new === 2);

    void d2;
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().finally(() => db.$disconnect());

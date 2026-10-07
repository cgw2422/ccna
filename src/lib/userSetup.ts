import type { PrismaClient } from "@prisma/client";
import { CCNA_DOMAINS, DEFAULT_SOURCE } from "./ccna";
import { DEMO_DAYS, DEMO_SOURCE, DEMO_UNASSIGNED } from "./demoData";
import { cardHashes } from "./content/hash";
import { sanitizeCardHtml } from "./content/sanitize";
import { splitTags } from "./import/dayDetect";

export async function ensureDomains(db: PrismaClient) {
  for (const d of CCNA_DOMAINS) {
    await db.ccnaDomain.upsert({ where: { id: d.id }, update: { name: d.name, key: d.key, examWeight: d.examWeight, sortOrder: d.sortOrder }, create: { ...d } });
  }
}

/** The user's primary deck (created on demand). */
export async function ensureDeck(db: PrismaClient, userId: string) {
  const existing = await db.deck.findFirst({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return db.deck.create({
    data: { ownerId: userId, name: "Jeremy's IT Lab CCNA", source: DEFAULT_SOURCE, description: "CCNA 200-301 flashcards organized by study day" },
  });
}

export async function createUserWithDefaults(
  db: PrismaClient,
  input: { email: string; passwordHash: string; name?: string | null; timezone?: string; withDemo?: boolean },
) {
  await ensureDomains(db);
  const user = await db.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      settings: { create: { timezone: input.timezone ?? "UTC" } },
    },
  });
  const deck = await ensureDeck(db, user.id);
  if (input.withDemo !== false) await seedDemoData(db, deck.id);
  return user;
}

export async function seedDemoData(db: PrismaClient, deckId: string) {
  let sortIndex = 0;
  for (const day of DEMO_DAYS) {
    const studyDay = await db.studyDay.upsert({
      where: { deckId_dayNumber: { deckId, dayNumber: day.day } },
      update: {},
      create: { deckId, dayNumber: day.day, title: day.title, domains: { create: day.domains.map((domainId) => ({ domainId })) } },
    });
    for (const c of day.cards) {
      await createDemoCard(db, deckId, studyDay.id, c, `Day_${String(day.day).padStart(2, "0")} ${c.tags ?? ""}`, sortIndex++);
    }
  }
  for (const c of DEMO_UNASSIGNED) await createDemoCard(db, deckId, null, c, c.tags ?? "", sortIndex++);
}

async function createDemoCard(
  db: PrismaClient,
  deckId: string,
  studyDayId: string | null,
  c: { front: string; back: string },
  rawTags: string,
  sortIndex: number,
) {
  const front = sanitizeCardHtml(c.front);
  const back = sanitizeCardHtml(c.back);
  const { contentHash, frontHash } = cardHashes(front, back);
  const exists = await db.card.findFirst({ where: { deckId, contentHash }, select: { id: true } });
  if (exists) return;
  const tags = splitTags(rawTags);
  await db.card.create({
    data: {
      deckId,
      studyDayId,
      front,
      back,
      source: DEMO_SOURCE,
      sourceTags: tags.join(" "),
      contentHash,
      frontHash,
      sortIndex,
      tags: { create: tags.map((tag) => ({ tag })) },
    },
  });
}

/** Removes demo cards (and their progress) plus demo days left empty. */
export async function removeDemoData(db: PrismaClient, deckId: string) {
  const demoDays = await db.card.findMany({
    where: { deckId, source: DEMO_SOURCE, studyDayId: { not: null } },
    select: { studyDayId: true },
    distinct: ["studyDayId"],
  });
  const { count } = await db.card.deleteMany({ where: { deckId, source: DEMO_SOURCE } });
  const ids = demoDays.map((d) => d.studyDayId!).filter(Boolean);
  if (ids.length) await db.studyDay.deleteMany({ where: { id: { in: ids }, cards: { none: {} } } });
  return count;
}

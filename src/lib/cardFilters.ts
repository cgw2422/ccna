import type { Prisma } from "@prisma/client";

export type CardFilterParams = { q?: string; day?: string; domain?: string; status?: string; source?: string };

/** Card browser filters → Prisma where. Shared by the list and bulk actions so they always agree. */
export function buildCardWhere(userId: string, deckIds: string[], dayEnd: Date, f: CardFilterParams): Prisma.CardWhereInput {
  const and: Prisma.CardWhereInput[] = [];
  const q = f.q?.trim();
  if (q) {
    and.push({
      OR: [
        { front: { contains: q, mode: "insensitive" } },
        { back: { contains: q, mode: "insensitive" } },
        { tags: { some: { tag: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (f.day === "unassigned") and.push({ studyDayId: null });
  else if (f.day) and.push({ studyDayId: f.day });
  if (f.domain) and.push({ studyDay: { domains: { some: { domainId: Number(f.domain) } } } });
  if (f.source) and.push({ source: f.source });
  const mine = { userId };
  switch (f.status) {
    case "new":
      and.push({ progress: { none: mine } });
      break;
    case "learning":
      and.push({ progress: { some: { ...mine, state: { in: ["LEARNING", "RELEARNING"] } } } });
      break;
    case "learned":
      and.push({ progress: { some: { ...mine, state: "REVIEW" } } });
      break;
    case "due":
      and.push({ progress: { some: { ...mine, due: { lte: dayEnd } } } });
      break;
    case "weak":
      and.push({ progress: { some: { ...mine, OR: [{ againCount: { gt: 0 } }, { hardCount: { gt: 0 } }] } } });
      break;
  }
  return { deckId: { in: deckIds }, ...(and.length ? { AND: and } : {}) };
}

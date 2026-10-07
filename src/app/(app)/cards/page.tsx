import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { htmlToPlainText } from "@/lib/content/sanitize";
import { getStudyContext } from "@/lib/study/queue";
import { PageHeader } from "@/components/PageHeader";
import { CardBrowser, type BrowserCard } from "./CardBrowser";

export const metadata = { title: "Cards" };

const PAGE_SIZE = 50;

type Search = { q?: string; day?: string; domain?: string; status?: string; source?: string; page?: string };

export default async function CardsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.CardWhereInput = { deckId: { in: ctx.deckIds } };
  const and: Prisma.CardWhereInput[] = [];
  const q = sp.q?.trim();
  if (q) {
    and.push({
      OR: [
        { front: { contains: q, mode: "insensitive" } },
        { back: { contains: q, mode: "insensitive" } },
        { tags: { some: { tag: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (sp.day === "unassigned") and.push({ studyDayId: null });
  else if (sp.day) and.push({ studyDayId: sp.day });
  if (sp.domain) and.push({ studyDay: { domains: { some: { domainId: Number(sp.domain) } } } });
  if (sp.source) and.push({ source: sp.source });
  const mine = { userId: user.id };
  switch (sp.status) {
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
      and.push({ progress: { some: { ...mine, due: { lte: ctx.dayEnd } } } });
      break;
    case "weak":
      and.push({ progress: { some: { ...mine, OR: [{ againCount: { gt: 0 } }, { hardCount: { gt: 0 } }] } } });
      break;
  }
  if (and.length) where.AND = and;

  const [cards, total, days, domains, sources] = await Promise.all([
    prisma.card.findMany({
      where,
      orderBy: [{ studyDay: { dayNumber: "asc" } }, { sortIndex: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        front: true,
        source: true,
        studyDay: { select: { dayNumber: true } },
        progress: { where: mine, select: { state: true, due: true } },
      },
    }),
    prisma.card.count({ where }),
    prisma.studyDay.findMany({ where: { deckId: { in: ctx.deckIds } }, orderBy: { dayNumber: "asc" }, select: { id: true, dayNumber: true, title: true } }),
    prisma.ccnaDomain.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.card.groupBy({ by: ["source"], where: { deckId: { in: ctx.deckIds } }, _count: { _all: true } }),
  ]);

  const rows: BrowserCard[] = cards.map((c) => {
    const p = c.progress[0];
    return {
      id: c.id,
      text: htmlToPlainText(c.front).replace(/\s+/g, " ").trim().slice(0, 160) || "(image)",
      day: c.studyDay?.dayNumber ?? null,
      state: p ? p.state : "NEW",
      due: p ? p.due.toISOString() : null,
      isDue: p ? p.due <= ctx.dayEnd : false,
    };
  });

  return (
    <>
      <PageHeader title="Cards" subtitle={`${total.toLocaleString()} ${total === 1 ? "card" : "cards"}`} back="/study" />
      <CardBrowser
        cards={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        filters={sp}
        days={days}
        domains={domains}
        sources={sources.map((s) => ({ name: s.source, count: s._count._all }))}
      />
    </>
  );
}

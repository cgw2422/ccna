import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/PageHeader";
import { PlanClient, type PlanDay } from "./PlanClient";

export const metadata = { title: "Study Plan" };

export default async function PlanPage() {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const [days, unassignedCount, settings, domains] = await Promise.all([
    prisma.studyDay.findMany({
      where: { deckId: deck.id },
      orderBy: { dayNumber: "asc" },
      select: {
        id: true,
        dayNumber: true,
        title: true,
        _count: { select: { cards: true } },
        domains: { select: { domainId: true } },
        userStates: { where: { userId: user.id }, select: { status: true } },
      },
    }),
    prisma.card.count({ where: { deckId: deck.id, studyDayId: null } }),
    getSettings(user.id),
    prisma.ccnaDomain.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const planDays: PlanDay[] = days.map((d) => ({
    id: d.id,
    dayNumber: d.dayNumber,
    title: d.title,
    cardCount: d._count.cards,
    status: d.userStates[0]?.status ?? "ACTIVE",
    domainIds: d.domains.map((x) => x.domainId),
  }));

  return (
    <>
      <PageHeader title="Study Plan" subtitle="Choose which Jeremy's IT Lab days feed your study sessions" />
      <PlanClient
        days={planDays}
        unassigned={{ count: unassignedCount, status: settings.unassignedStatus }}
        domains={domains}
      />
    </>
  );
}

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { PageHeader } from "@/components/PageHeader";
import { CustomStudyForm } from "./CustomStudyForm";

export const metadata = { title: "Custom Study" };

export default async function CustomStudyPage() {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const [days, domains] = await Promise.all([
    prisma.studyDay.findMany({
      where: { deckId: deck.id },
      orderBy: { dayNumber: "asc" },
      select: { id: true, dayNumber: true, title: true, _count: { select: { cards: true } }, userStates: { where: { userId: user.id }, select: { status: true } } },
    }),
    prisma.ccnaDomain.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Custom Study" subtitle="A temporary session — your Study Plan stays unchanged" back="/study" />
      <CustomStudyForm
        days={days.map((d) => ({ id: d.id, dayNumber: d.dayNumber, title: d.title, cards: d._count.cards, status: d.userStates[0]?.status ?? "ACTIVE" }))}
        domains={domains}
      />
    </>
  );
}

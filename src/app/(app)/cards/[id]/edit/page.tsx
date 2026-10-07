import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { PageHeader } from "@/components/PageHeader";
import { EditCardForm } from "./EditCardForm";

export default async function EditCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const card = await prisma.card.findFirst({ where: { id, deckId: deck.id }, include: { tags: true } });
  if (!card) notFound();
  const days = await prisma.studyDay.findMany({ where: { deckId: deck.id }, orderBy: { dayNumber: "asc" }, select: { id: true, dayNumber: true, title: true } });
  return (
    <>
      <PageHeader title="Edit card" back={`/cards/${card.id}`} />
      <EditCardForm
        cardId={card.id}
        front={card.front}
        back={card.back}
        tags={card.tags.map((t) => t.tag).join(" ")}
        dayId={card.studyDayId ?? ""}
        days={days}
      />
    </>
  );
}

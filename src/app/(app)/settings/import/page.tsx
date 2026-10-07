import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { DEMO_SOURCE } from "@/lib/demoData";
import { PageHeader } from "@/components/PageHeader";
import { ImportWizard } from "./ImportWizard";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const demoCount = await prisma.card.count({ where: { deckId: deck.id, source: DEMO_SOURCE } });
  return (
    <>
      <PageHeader title="Import cards" subtitle="Bring in Jeremy's IT Lab deck — thousands of cards at once" back="/settings" />
      <ImportWizard demoCount={demoCount} />
    </>
  );
}

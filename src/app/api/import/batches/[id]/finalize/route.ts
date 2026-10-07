import { revalidatePath } from "next/cache";
import { withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/study/session";
import { removeDemoData } from "@/lib/userSetup";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withUser<Ctx>(async (_req, user, { params }) => {
  const { id } = await params;
  const batch = await prisma.importBatch.findFirst({ where: { id, userId: user.id } });
  if (!batch) throw new HttpError(404, "Import not found");
  const opts = (batch.options ?? {}) as { removeDemo?: boolean };
  let demoRemoved = 0;
  if (opts.removeDemo && batch.createdCount + batch.updatedCount > 0) demoRemoved = await removeDemoData(prisma, batch.deckId);
  const done = await prisma.importBatch.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
  revalidatePath("/", "layout");
  return { batch: done, demoRemoved };
});

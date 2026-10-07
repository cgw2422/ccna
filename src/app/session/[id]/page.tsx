import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getSessionState, HttpError } from "@/lib/study/session";
import { prisma } from "@/lib/db";
import { StudyScreen } from "./StudyScreen";

export const metadata = { title: "Study" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await prisma.studySession.findFirst({ where: { id, userId: user.id }, select: { type: true, name: true } });
  if (!session) notFound();
  const settings = await getSettings(user.id);
  let initial;
  try {
    initial = await getSessionState(user.id, id);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  return (
    <StudyScreen
      initial={initial}
      sessionName={session.type === "MAIN" ? null : session.name}
      autoShowAnswerSeconds={settings.autoShowAnswerSeconds}
    />
  );
}

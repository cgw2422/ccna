import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Play, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStudyContext } from "@/lib/study/queue";
import { getDayAggregates, getReviewAggregatesByDay } from "@/lib/study/stats";
import { PageHeader } from "@/components/PageHeader";
import { ProgressBar, masteryTone } from "@/components/ProgressBar";
import { startDaySession, startWeakSession } from "../../study/actions";
import { DayEditor } from "./DayEditor";

export default async function DayPage({ params, searchParams }: { params: Promise<{ dayId: string }>; searchParams: Promise<{ from?: string }> }) {
  const { dayId } = await params;
  const { from } = await searchParams;
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const day = await prisma.studyDay.findFirst({
    where: { id: dayId, deckId: { in: ctx.deckIds } },
    include: { domains: true, userStates: { where: { userId: user.id } }, _count: { select: { cards: true } } },
  });
  if (!day) notFound();
  const [aggs, revs, domains, weakCount] = await Promise.all([
    getDayAggregates(ctx),
    getReviewAggregatesByDay(ctx),
    prisma.ccnaDomain.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.userCardProgress.count({ where: { userId: user.id, card: { studyDayId: day.id }, OR: [{ againCount: { gt: 0 } }, { hardCount: { gt: 0 } }] } }),
  ]);
  const a = aggs.get(day.id);
  const r = revs.get(day.id);
  const mastery = a && a.total ? Math.round((a.masterySum / a.total) * 100) : 0;
  const accuracy = r && r.total ? Math.round((r.correct / r.total) * 100) : null;
  const status = day.userStates[0]?.status ?? "ACTIVE";

  return (
    <>
      <PageHeader title={`Day ${day.dayNumber}`} subtitle={day.title} back={from === "stats" ? "/stats" : "/plan"} />
      <div className="space-y-4">
        <section className="panel p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted">Mastery</span>
            <span className="font-bold tabular-nums">{mastery}%</span>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={mastery} tone={masteryTone(mastery)} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Cards" value={day._count.cards} />
            <Stat label="Learned" value={a?.learned ?? 0} />
            <Stat label="Unseen" value={(a?.total ?? 0) - (a?.seen ?? 0)} />
            <Stat label="Due" value={a?.dueReviews ?? 0} />
            <Stat label="Reviews" value={r?.total ?? 0} />
            <Stat label="Accuracy" value={accuracy == null ? "—" : `${accuracy}%`} />
          </dl>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <form action={startDaySession}>
            <input type="hidden" name="dayId" value={day.id} />
            <button className="btn btn-primary w-full" disabled={day._count.cards === 0}>
              <Play className="size-4" /> Study this day
            </button>
          </form>
          <Link href={`/cards?day=${day.id}`} className="btn btn-secondary">
            <BookOpen className="size-4" /> Browse cards
          </Link>
          {weakCount > 0 && (
            <form action={startWeakSession} className="col-span-2">
              <input type="hidden" name="dayId" value={day.id} />
              <button className="btn btn-secondary w-full">
                <Zap className="size-4 text-warning" /> Study {weakCount} weak {weakCount === 1 ? "card" : "cards"}
              </button>
            </form>
          )}
        </div>
        {status === "PAUSED" && (
          <p className="rounded-xl bg-paused-soft px-3.5 py-2.5 text-sm text-muted">
            This day is paused. &ldquo;Study this day&rdquo; still lets you review it on demand without changing your plan.
          </p>
        )}

        <DayEditor
          dayId={day.id}
          title={day.title}
          status={status}
          domainIds={day.domains.map((d) => d.domainId)}
          domains={domains.map((d) => ({ id: d.id, name: d.name }))}
        />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2.5">
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
      <dt className="text-xs font-medium text-muted">{label}</dt>
    </div>
  );
}

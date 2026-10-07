import Link from "next/link";
import { CalendarDays, ChevronRight, Flame, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDueCounts, getStudyContext } from "@/lib/study/queue";
import { getOverview, getPlanSummary } from "@/lib/study/stats";
import { daysUntil } from "@/lib/time";
import { ProgressBar } from "@/components/ProgressBar";
import { startMainSession } from "./study/actions";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const [due, overview, plan] = await Promise.all([getDueCounts(ctx), getOverview(ctx), getPlanSummary(user.id, ctx.deckIds)]);
  const exam = ctx.settings.examDate;
  const remainingDays = exam ? daysUntil(exam, ctx.now, ctx.settings.timezone) : null;
  const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: ctx.settings.timezone }).format(ctx.now);

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <p className="text-sm font-medium text-muted">{todayLabel}</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Today</h1>
      </header>

      {/* Exam countdown */}
      {exam ? (
        <Link href="/settings#exam" className="panel flex items-center gap-4 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <CalendarDays className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">CCNA Exam</p>
            <p className="font-semibold">
              {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(exam)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl leading-none font-extrabold tabular-nums">{Math.max(0, remainingDays ?? 0)}</p>
            <p className="mt-1 text-[11px] font-bold tracking-wider text-muted uppercase">
              {remainingDays === 0 ? "Exam day!" : remainingDays! < 0 ? "Days ago" : remainingDays === 1 ? "Day left" : "Days left"}
            </p>
          </div>
        </Link>
      ) : (
        <Link href="/settings#exam" className="panel flex items-center gap-3 p-4 text-sm">
          <CalendarDays className="size-5 text-primary" />
          <span className="flex-1 font-medium">Set your CCNA exam date to see a countdown</span>
          <ChevronRight className="size-5 text-muted" />
        </Link>
      )}

      {/* Cards due */}
      <section className="panel p-5">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-extrabold tracking-tight tabular-nums">{due.total}</span>
          <span className="text-lg font-semibold text-muted">{due.total === 1 ? "card due" : "cards due"}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <DueStat label="New" value={due.new} color="bg-primary" />
          <DueStat label="Learning" value={due.learning} color="bg-danger" />
          <DueStat label="Review" value={due.review} color="bg-success" />
        </div>
        <form action={startMainSession} className="mt-5">
          <button className="btn btn-primary min-h-14 w-full text-lg tracking-wide" disabled={due.total === 0 && due.learningNow === 0}>
            {due.total === 0 ? "ALL CAUGHT UP" : "START STUDYING"}
          </button>
        </form>
        {due.total === 0 && (
          <p className="mt-3 text-center text-sm text-muted">
            Nothing due right now. Try <Link className="font-semibold text-primary" href="/study/custom">Custom Study</Link> or
            activate more days in your <Link className="font-semibold text-primary" href="/plan">Study Plan</Link>.
          </p>
        )}
      </section>

      {/* Study plan summary */}
      <section className="panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Study Plan</h2>
          <span className="text-sm text-muted">{plan.total} days</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <PlanStat value={plan.ACTIVE} label="Active" className="text-success" />
          <PlanStat value={plan.REVIEW_ONLY} label="Review only" className="text-warning" />
          <PlanStat value={plan.PAUSED} label="Paused" className="text-paused" />
        </div>
        <Link href="/plan" className="btn btn-secondary mt-4 w-full">
          Manage Study Plan
        </Link>
      </section>

      {/* Progress */}
      <section className="panel p-4">
        <h2 className="font-bold">Progress</h2>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-medium text-muted">Overall mastery</span>
          <span className="font-bold tabular-nums">{overview.mastery}%</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={overview.mastery} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Cards learned" value={overview.learned} />
          <Metric label="Cards remaining" value={overview.remaining} />
          <Metric label="Reviews today" value={overview.reviewsToday} icon={<Target className="size-4 text-primary" />} />
          <Metric
            label="Study streak"
            value={`${overview.streak} ${overview.streak === 1 ? "day" : "days"}`}
            icon={<Flame className={`size-4 ${overview.streak ? "text-warning" : "text-muted"}`} />}
          />
        </dl>
      </section>
    </div>
  );
}

function DueStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className={`size-2 rounded-full ${color}`} /> {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function PlanStat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2.5">
      <div className={`text-2xl font-bold tabular-nums ${className}`}>{value}</div>
      <div className="text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

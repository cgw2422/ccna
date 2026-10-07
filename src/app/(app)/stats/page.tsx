import Link from "next/link";
import { ChevronRight, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDueCounts, getStudyContext } from "@/lib/study/queue";
import { countWeakCards, getDayStats, getDomainStats, getOverview, getRecentActivity } from "@/lib/study/stats";
import { PageHeader } from "@/components/PageHeader";
import { ProgressBar, masteryTone } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { startWeakSession } from "../study/actions";

export const metadata = { title: "Stats" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ weak?: string }> }) {
  const { weak: weakFlag } = await searchParams;
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const [overview, due, days, activity, weakCount] = await Promise.all([
    getOverview(ctx),
    getDueCounts(ctx),
    getDayStats(ctx),
    getRecentActivity(ctx, 14),
    countWeakCards(ctx),
  ]);
  const domains = await getDomainStats(ctx, days);
  const weakDays = days
    .filter((d) => d.status !== "PAUSED" && d.reviews >= 5 && d.againRate != null && d.againRate > 0)
    .sort((a, b) => (b.againRate ?? 0) - (a.againRate ?? 0))
    .slice(0, 5);
  const maxActivity = Math.max(1, ...activity.map((a) => a.count));

  return (
    <>
      <PageHeader title="Stats" subtitle={`${overview.totalCards.toLocaleString()} cards in your deck`} />
      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Tile label="Cards learned" value={overview.learned} />
          <Tile label="Cards unseen" value={overview.unseen} />
          <Tile label="Cards due" value={due.total} />
          <Tile label="Mastery" value={`${overview.mastery}%`} />
          <Tile label="Reviews today" value={overview.reviewsToday} />
          <Tile label="Reviews this week" value={overview.reviewsWeek} />
          <Tile label="Accuracy (30d)" value={overview.accuracy == null ? "—" : `${overview.accuracy}%`} />
          <Tile label="Study streak" value={`${overview.streak}d`} />
        </section>

        <section className="panel p-4">
          <h2 className="font-bold">Reviews · last 14 days</h2>
          <div className="mt-4 flex h-28 items-end gap-1" role="img" aria-label="Reviews per day for the last 14 days">
            {activity.map((a) => (
              <div key={a.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${a.date}: ${a.count} reviews`}>
                <div
                  className={`rounded-t-[4px] ${a.count ? "bg-primary" : "bg-surface-2"}`}
                  style={{ height: a.count ? `${Math.max(4, (a.count / maxActivity) * 100)}%` : "4px" }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-text px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-bg group-hover:block">
                  {a.count}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>{activity[0]?.date.slice(5)}</span>
            <span>Today</span>
          </div>
        </section>

        {/* Weak areas */}
        <section className="panel p-4">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-warning" />
            <h2 className="font-bold">Weak Areas</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            Based on cards you frequently rate Again or Hard. {weakCount > 0 ? `${weakCount} weak cards.` : ""}
          </p>
          {weakFlag === "empty" && <p className="mt-2 text-sm font-medium text-warning">No weak cards found outside paused days.</p>}
          {weakDays.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {weakDays.map((d) => (
                <li key={d.id}>
                  <Link href={`/plan/${d.id}?from=stats`} className="flex items-center gap-3 py-2.5">
                    <span className="w-14 shrink-0 text-sm font-bold text-muted tabular-nums">Day {d.dayNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
                    <span className="text-sm font-semibold text-danger tabular-nums">{Math.round((d.againRate ?? 0) * 100)}% missed</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Not enough reviews yet to find weak days.</p>
          )}
          <form action={startWeakSession} className="mt-3">
            <button className="btn btn-primary w-full" disabled={weakCount === 0}>
              STUDY WEAK AREAS
            </button>
          </form>
        </section>

        {/* Domains */}
        <section className="panel p-4">
          <h2 className="font-bold">CCNA Domains</h2>
          <p className="mt-1 text-sm text-muted">Mastery of the study days assigned to each exam domain.</p>
          <ul className="mt-3 space-y-3.5">
            {domains.map((d) => (
              <li key={d.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="font-bold tabular-nums">{d.mastery == null ? "—" : `${d.mastery}%`}</span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={d.mastery ?? 0} tone={masteryTone(d.mastery)} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {d.examWeight}% of exam · {d.dayCount} days · {d.cards} cards
                  {d.accuracy != null && ` · ${d.accuracy}% accuracy`}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Assign domains to days from the Study Plan (tap a day).</p>
        </section>

        {/* Mastery by day */}
        <section className="panel overflow-hidden">
          <h2 className="px-4 pt-4 font-bold">Mastery by study day</h2>
          <ul className="mt-2 divide-y divide-border">
            {days.map((d) => (
              <li key={d.id}>
                <Link href={`/plan/${d.id}?from=stats`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                  <span className="w-14 shrink-0 text-sm font-bold text-muted tabular-nums">Day {d.dayNumber}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{d.title}</span>
                      {d.status !== "ACTIVE" && <StatusBadge status={d.status} />}
                    </span>
                    <span className="mt-1.5 block">
                      <ProgressBar value={d.mastery} tone={masteryTone(d.mastery)} />
                    </span>
                  </span>
                  <span className="w-11 text-right text-sm font-bold tabular-nums">{d.mastery}%</span>
                  <ChevronRight className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
            {days.length === 0 && <li className="p-6 text-center text-sm text-muted">No study days yet.</li>}
          </ul>
          <p className="px-4 py-3 text-xs text-muted">
            Mastery grows as cards graduate to review and their memory stability approaches 3 weeks.
          </p>
        </section>
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="panel px-3.5 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

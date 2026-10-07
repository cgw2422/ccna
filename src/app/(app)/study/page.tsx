import Link from "next/link";
import { BookOpen, ChevronRight, SlidersHorizontal, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDueCounts, getStudyContext } from "@/lib/study/queue";
import { countWeakCards } from "@/lib/study/stats";
import { PageHeader } from "@/components/PageHeader";
import { startMainSession, startWeakSession } from "./actions";

export const metadata = { title: "Study" };

export default async function StudyHub() {
  const user = await requireUser();
  const ctx = await getStudyContext(user.id);
  const [due, weak] = await Promise.all([getDueCounts(ctx), countWeakCards(ctx)]);

  return (
    <>
      <PageHeader title="Study" subtitle="Your main session follows your Study Plan" />
      <div className="space-y-3">
        <section className="panel p-5">
          <p className="text-sm font-semibold text-muted">Main session</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">{due.total}</p>
          <p className="text-sm text-muted">
            {due.new} new · {due.learning} learning · {due.review} review
          </p>
          <form action={startMainSession} className="mt-4">
            <button className="btn btn-primary min-h-14 w-full text-lg tracking-wide" disabled={due.total === 0 && due.learningNow === 0}>
              START STUDYING
            </button>
          </form>
        </section>

        <form action={startWeakSession}>
          <button className="panel flex w-full items-center gap-4 p-4 text-left disabled:opacity-60" disabled={weak === 0}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning">
              <Zap className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Study Weak Areas</span>
              <span className="block text-sm text-muted">
                {weak > 0 ? `${weak} cards you often miss · skips paused days` : "No weak cards yet — keep studying"}
              </span>
            </span>
            <ChevronRight className="size-5 text-muted" />
          </button>
        </form>

        <HubLink href="/study/custom" icon={<SlidersHorizontal className="size-6" />} tone="bg-primary-soft text-primary" title="Custom Study" body="Pick days, a range, a domain, missed or random cards" />
        <HubLink href="/cards" icon={<BookOpen className="size-6" />} tone="bg-success-soft text-success" title="Card Browser" body="Search, filter, edit and assign cards" />
      </div>
    </>
  );
}

function HubLink({ href, icon, tone, title, body }: { href: string; icon: React.ReactNode; tone: string; title: string; body: string }) {
  return (
    <Link href={href} className="panel flex items-center gap-4 p-4">
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
      <ChevronRight className="size-5 text-muted" />
    </Link>
  );
}

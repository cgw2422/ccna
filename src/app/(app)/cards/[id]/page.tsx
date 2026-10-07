import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { formatCardHtml } from "@/lib/content/format";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/PageHeader";

const RATING = { 1: ["Again", "text-danger"], 2: ["Hard", "text-warning"], 3: ["Good", "text-success"], 4: ["Easy", "text-easy"] } as const;
const STATE_LABEL = { NEW: "New", LEARNING: "Learning", RELEARNING: "Relearning", REVIEW: "Learned (review)" } as const;

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const card = await prisma.card.findFirst({
    where: { id, deckId: deck.id },
    include: {
      studyDay: true,
      tags: { orderBy: { tag: "asc" } },
      importBatch: { select: { fileName: true, createdAt: true } },
      progress: { where: { userId: user.id } },
      reviews: { where: { userId: user.id }, orderBy: { reviewedAt: "desc" }, take: 50 },
    },
  });
  if (!card) notFound();
  const settings = await getSettings(user.id);
  const fmt = (d: Date, withTime = false) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}), timeZone: settings.timezone }).format(d);
  const p = card.progress[0];

  return (
    <>
      <PageHeader
        title="Card"
        subtitle={card.studyDay ? `Day ${card.studyDay.dayNumber} • ${card.studyDay.title}` : "Unassigned"}
        back="/cards"
        action={
          <Link href={`/cards/${card.id}/edit`} className="btn btn-secondary min-h-10 px-3.5 text-sm">
            <Pencil className="size-4" /> Edit
          </Link>
        }
      />
      <div className="space-y-3">
        <section className="panel p-5">
          <p className="section-title">Front</p>
          <div className="card-content card-content-sm" dangerouslySetInnerHTML={{ __html: formatCardHtml(card.front, "front") }} />
          <hr className="my-4 border-border" />
          <p className="section-title">Back</p>
          <div className="card-content card-content-sm" dangerouslySetInnerHTML={{ __html: formatCardHtml(card.back, "back") }} />
          {card.extra && (
            <>
              <hr className="my-4 border-border" />
              <p className="section-title">Extra</p>
              <div className="card-content card-content-sm" dangerouslySetInnerHTML={{ __html: formatCardHtml(card.extra, "back") }} />
            </>
          )}
        </section>

        <section className="panel divide-y divide-border text-sm">
          <Row label="Study day">{card.studyDay ? <Link className="font-semibold text-primary" href={`/plan/${card.studyDay.id}`}>Day {card.studyDay.dayNumber} — {card.studyDay.title}</Link> : "Unassigned"}</Row>
          <Row label="Status">{p ? STATE_LABEL[p.state] : "New (unseen)"}</Row>
          <Row label="Next due">{p ? fmt(p.due, p.state !== "REVIEW") : "—"}</Row>
          {p && (
            <>
              <Row label="Reviews / lapses">{p.reps} / {p.lapses}</Row>
              <Row label="Stability">{p.stability.toFixed(1)} days</Row>
              <Row label="Difficulty">{p.difficulty.toFixed(1)} / 10</Row>
              <Row label="Again / Hard">{p.againCount} / {p.hardCount}</Row>
            </>
          )}
          <Row label="Source">{card.source}</Row>
          {card.importBatch && <Row label="Imported">{card.importBatch.fileName} · {fmt(card.importBatch.createdAt)}</Row>}
          {card.sourceDeck && <Row label="Anki deck">{card.sourceDeck}</Row>}
        </section>

        <section className="panel p-4">
          <p className="section-title">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {card.tags.length ? card.tags.map((t) => <span key={t.tag} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">{t.tag}</span>) : <span className="text-sm text-muted">No tags</span>}
          </div>
        </section>

        <section className="panel p-4">
          <p className="section-title">Review history</p>
          {card.reviews.length === 0 ? (
            <p className="text-sm text-muted">Not reviewed yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {card.reviews.map((r) => {
                const [label, cls] = RATING[r.rating as 1 | 2 | 3 | 4];
                return (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span className="text-muted">{fmt(r.reviewedAt, true)}</span>
                    <span className={`font-semibold ${cls}`}>{label}</span>
                    <span className="w-20 text-right text-muted tabular-nums">{r.scheduledDays > 0 ? `${r.scheduledDays}d` : "<1d"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

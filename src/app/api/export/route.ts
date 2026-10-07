import Papa from "papaparse";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Full data export — the app never traps study data. */
export async function GET(req: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  const [settings, decks, progress, reviews, imports, domains] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
    prisma.deck.findMany({
      where: { ownerId: user.id },
      include: {
        studyDays: {
          orderBy: { dayNumber: "asc" },
          include: { domains: { include: { domain: true } }, userStates: { where: { userId: user.id } } },
        },
        cards: { orderBy: { sortIndex: "asc" }, include: { tags: true, studyDay: { select: { dayNumber: true } } } },
      },
    }),
    prisma.userCardProgress.findMany({ where: { userId: user.id } }),
    prisma.review.findMany({ where: { userId: user.id }, orderBy: { reviewedAt: "asc" }, omit: { prevProgress: true } }),
    prisma.importBatch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.ccnaDomain.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const progressByCard = new Map(progress.map((p) => [p.cardId, p]));

  if (format === "csv") {
    const rows = decks.flatMap((d) =>
      d.cards.map((c) => {
        const p = progressByCard.get(c.id);
        return {
          card_id: c.id,
          day: c.studyDay?.dayNumber ?? "",
          front: c.front,
          back: c.back,
          extra: c.extra ?? "",
          tags: c.tags.map((t) => t.tag).join(" "),
          source: c.source,
          source_id: c.sourceId ?? "",
          state: p?.state ?? "NEW",
          due: p?.due.toISOString() ?? "",
          stability: p?.stability ?? "",
          difficulty: p?.difficulty ?? "",
          reps: p?.reps ?? 0,
          lapses: p?.lapses ?? 0,
          last_review: p?.lastReview?.toISOString() ?? "",
        };
      }),
    );
    return new NextResponse("﻿" + Papa.unparse(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ccna-cards-${stamp}.csv"`,
      },
    });
  }

  const data = {
    exportedAt: new Date().toISOString(),
    format: "ccna-cards-export",
    version: 1,
    user: { email: user.email, name: user.name },
    settings,
    domains,
    decks: decks.map((d) => ({
      id: d.id,
      name: d.name,
      source: d.source,
      studyDays: d.studyDays.map((s) => ({
        id: s.id,
        dayNumber: s.dayNumber,
        title: s.title,
        status: s.userStates[0]?.status ?? "ACTIVE",
        domains: s.domains.map((x) => x.domain.name),
      })),
      cards: d.cards.map((c) => ({
        id: c.id,
        dayNumber: c.studyDay?.dayNumber ?? null,
        front: c.front,
        back: c.back,
        extra: c.extra,
        tags: c.tags.map((t) => t.tag),
        source: c.source,
        sourceId: c.sourceId,
        sourceTags: c.sourceTags,
        sourceDeck: c.sourceDeck,
        importBatchId: c.importBatchId,
        createdAt: c.createdAt,
        progress: progressByCard.get(c.id) ?? null,
      })),
    })),
    reviews,
    imports,
  };
  return new NextResponse(JSON.stringify(data, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ccna-cards-${stamp}.json"`,
    },
  });
}

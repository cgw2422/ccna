import "server-only";
import { randomUUID } from "node:crypto";
import type { ImportBatch, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { defaultDayDomains, defaultDayTitle } from "../ccna";
import { cardHashes } from "../content/hash";
import { sanitizeCardHtml } from "../content/sanitize";
import { detectDayForCard, detectDayTitle, splitTags } from "./dayDetect";
import type { ChunkResult, ImportOptions, MappedRow } from "./types";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toHtml(value: string | undefined, fieldsAreHtml: boolean): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (fieldsAreHtml) return sanitizeCardHtml(v);
  return sanitizeCardHtml(escapeHtml(v).replace(/\r?\n/g, "<br>"));
}

type Prepared = {
  rowIndex: number;
  front: string;
  back: string;
  extra: string | null;
  tags: string[];
  rawTags: string;
  dayNumber: number | null;
  dayTitleHint: string | null;
  deckName: string | null;
  sourceId: string | null;
  contentHash: string;
  frontHash: string;
};

/**
 * Import one chunk of mapped rows into the batch's deck.
 *
 * Duplicate rules (in order):
 *  1. Same source ID (Anki GUID): identical content → duplicate; changed → updated.
 *  2. Same front+back (normalized) → duplicate (skipped).
 *  3. Same front, different back → per `duplicateMode`: update existing / import as new / skip.
 * Within a file, repeated rows are skipped as duplicates too.
 */
export async function importChunk(batch: ImportBatch, rows: MappedRow[], startIndex: number): Promise<ChunkResult> {
  const opts = batch.options as unknown as ImportOptions & { baseSortIndex: number };
  const result: ChunkResult = { created: 0, duplicates: 0, updated: 0, errors: 0, unassigned: 0, daysCreated: 0 };
  const deckId = batch.deckId;

  const prepared: Prepared[] = [];
  rows.forEach((row, i) => {
    const front = toHtml(row.front, opts.fieldsAreHtml);
    const back = toHtml(row.back, opts.fieldsAreHtml);
    if (!front && !back) {
      result.errors++;
      return;
    }
    const rawTags = (row.tags ?? "").trim();
    const tags = splitTags(rawTags).slice(0, 50);
    const deckName = row.deck?.trim() || null;
    const dayNumber = detectDayForCard(tags, deckName, row.day?.trim() || null);
    const titleHint = detectDayTitle(deckName) ?? tags.map(detectDayTitle).find(Boolean) ?? null;
    prepared.push({
      rowIndex: startIndex + i,
      front,
      back,
      extra: toHtml(row.extra, opts.fieldsAreHtml) || null,
      tags,
      rawTags,
      dayNumber,
      dayTitleHint: titleHint,
      deckName,
      sourceId: row.sourceId?.trim() || null,
      ...cardHashes(front, back),
    });
  });
  if (!prepared.length) return result;

  // Ensure study days exist.
  const dayNumbers = [...new Set(prepared.map((p) => p.dayNumber).filter((n): n is number => n != null))];
  const existingDays = await prisma.studyDay.findMany({ where: { deckId, dayNumber: { in: dayNumbers } }, select: { id: true, dayNumber: true } });
  const dayIdByNumber = new Map(existingDays.map((d) => [d.dayNumber, d.id]));
  for (const n of dayNumbers) {
    if (dayIdByNumber.has(n)) continue;
    const hint = prepared.find((p) => p.dayNumber === n && p.dayTitleHint)?.dayTitleHint;
    const day = await prisma.studyDay.upsert({
      where: { deckId_dayNumber: { deckId, dayNumber: n } },
      update: {},
      create: {
        deckId,
        dayNumber: n,
        title: hint ?? defaultDayTitle(n),
        domains: { create: defaultDayDomains(n).map((domainId) => ({ domainId })) },
      },
    });
    dayIdByNumber.set(n, day.id);
    result.daysCreated++;
  }

  // Prefetch potential matches in three queries.
  const sourceIds = prepared.map((p) => p.sourceId).filter((s): s is string => !!s);
  const [bySource, byContent, byFront] = await Promise.all([
    sourceIds.length
      ? prisma.card.findMany({ where: { deckId, sourceId: { in: sourceIds } }, select: { id: true, sourceId: true, contentHash: true, dayAssignedManually: true, studyDayId: true } })
      : [],
    prisma.card.findMany({ where: { deckId, contentHash: { in: prepared.map((p) => p.contentHash) } }, select: { id: true, contentHash: true } }),
    opts.duplicateMode !== "new"
      ? prisma.card.findMany({ where: { deckId, frontHash: { in: prepared.map((p) => p.frontHash) } }, select: { id: true, frontHash: true, dayAssignedManually: true, studyDayId: true } })
      : [],
  ]);
  const sourceMap = new Map(bySource.map((c) => [c.sourceId!, c]));
  const contentSet = new Set(byContent.map((c) => c.contentHash));
  const frontMap = new Map(byFront.map((c) => [c.frontHash, c]));

  const creates: Prisma.CardCreateManyInput[] = [];
  const tagCreates: Prisma.CardTagCreateManyInput[] = [];
  const updates: { id: string; p: Prepared; keepDay: boolean; currentDayId: string | null }[] = [];
  const seenInChunk = new Set<string>();

  for (const p of prepared) {
    const studyDayId = p.dayNumber != null ? dayIdByNumber.get(p.dayNumber)! : null;
    const src = p.sourceId ? sourceMap.get(p.sourceId) : undefined;
    if (src) {
      if (src.contentHash === p.contentHash) result.duplicates++;
      else {
        updates.push({ id: src.id, p, keepDay: src.dayAssignedManually, currentDayId: src.studyDayId });
        result.updated++;
      }
      continue;
    }
    if (contentSet.has(p.contentHash) || seenInChunk.has(p.contentHash)) {
      result.duplicates++;
      continue;
    }
    const sameFront = frontMap.get(p.frontHash);
    if (sameFront && opts.duplicateMode === "skip") {
      result.duplicates++;
      continue;
    }
    if (sameFront && opts.duplicateMode === "update") {
      updates.push({ id: sameFront.id, p, keepDay: sameFront.dayAssignedManually, currentDayId: sameFront.studyDayId });
      result.updated++;
      contentSet.add(p.contentHash);
      continue;
    }
    seenInChunk.add(p.contentHash);
    const id = randomUUID();
    creates.push({
      id,
      deckId,
      studyDayId,
      front: p.front,
      back: p.back,
      extra: p.extra,
      source: opts.source,
      sourceId: p.sourceId,
      sourceTags: p.rawTags,
      sourceDeck: p.deckName,
      contentHash: p.contentHash,
      frontHash: p.frontHash,
      importBatchId: batch.id,
      sortIndex: opts.baseSortIndex + p.rowIndex,
    });
    for (const tag of p.tags) tagCreates.push({ cardId: id, tag: tag.slice(0, 200) });
    if (!studyDayId) result.unassigned++;
    result.created++;
  }

  await prisma.$transaction(async (tx) => {
    if (creates.length) await tx.card.createMany({ data: creates });
    if (tagCreates.length) await tx.cardTag.createMany({ data: tagCreates, skipDuplicates: true });
    for (const u of updates) {
      const newDayId = u.p.dayNumber != null ? dayIdByNumber.get(u.p.dayNumber)! : null;
      // Card content changes; progress (UserCardProgress/Review) is untouched.
      await tx.card.update({
        where: { id: u.id },
        data: {
          front: u.p.front,
          back: u.p.back,
          extra: u.p.extra,
          contentHash: u.p.contentHash,
          frontHash: u.p.frontHash,
          sourceTags: u.p.rawTags,
          sourceDeck: u.p.deckName,
          ...(u.p.sourceId ? { sourceId: u.p.sourceId } : {}),
          ...(!u.keepDay && newDayId ? { studyDayId: newDayId } : {}),
        },
      });
      await tx.cardTag.deleteMany({ where: { cardId: u.id } });
      if (u.p.tags.length) await tx.cardTag.createMany({ data: u.p.tags.map((tag) => ({ cardId: u.id, tag: tag.slice(0, 200) })), skipDuplicates: true });
    }
    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "PROCESSING",
        totalRows: { increment: rows.length },
        createdCount: { increment: result.created },
        duplicateCount: { increment: result.duplicates },
        updatedCount: { increment: result.updated },
        errorCount: { increment: result.errors },
        unassignedCount: { increment: result.unassigned },
      },
    });
  }, { timeout: 60_000 });

  return result;
}

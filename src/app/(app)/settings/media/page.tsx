import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureDeck } from "@/lib/userSetup";
import { PageHeader } from "@/components/PageHeader";
import { MediaUploader } from "./MediaUploader";

export const metadata = { title: "Card images" };

export default async function MediaPage() {
  const user = await requireUser();
  const deck = await ensureDeck(prisma, user.id);
  const [assets, agg, cardsWithImages] = await Promise.all([
    prisma.mediaAsset.findMany({ where: { userId: user.id }, select: { filename: true } }),
    prisma.mediaAsset.aggregate({ where: { userId: user.id }, _sum: { size: true } }),
    prisma.card.findMany({
      where: { deckId: deck.id, OR: [{ front: { contains: "<img", mode: "insensitive" } }, { back: { contains: "<img", mode: "insensitive" } }] },
      select: { front: true, back: true, extra: true },
    }),
  ]);
  const have = new Set(assets.map((a) => a.filename));
  const referenced = new Set<string>();
  for (const c of cardsWithImages) {
    for (const html of [c.front, c.back, c.extra ?? ""]) {
      for (const m of html.matchAll(/<img\b[^>]*?\bsrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        const src = (m[1] ?? m[2] ?? m[3] ?? "").trim();
        if (src && !/^(https?:|data:|\/)/i.test(src)) {
          try {
            referenced.add(decodeURIComponent(src));
          } catch {
            referenced.add(src);
          }
        }
      }
    }
  }
  const missing = [...referenced].filter((f) => !have.has(f)).sort();
  const mb = ((agg._sum.size ?? 0) / 1024 / 1024).toFixed(1);

  return (
    <>
      <PageHeader title="Card images" subtitle={`${assets.length} images stored · ${mb} MB`} back="/settings" />
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Cards reference images by filename (e.g. <code>&lt;img src=&quot;ospf.png&quot;&gt;</code>). Upload images with matching filenames and they appear on
          your cards automatically. Images inside an imported <b>.apkg</b> are stored for you.
        </p>
        <MediaUploader />
        <section className="panel p-4">
          <p className="font-semibold">Referenced by cards: {referenced.size}</p>
          <p className="text-sm text-muted">{missing.length ? `${missing.length} missing` : "All referenced images are available."}</p>
          {missing.length > 0 && (
            <ul className="mt-2 max-h-60 overflow-y-auto font-mono text-xs text-muted">
              {missing.slice(0, 300).map((m) => (
                <li key={m} className="truncate py-0.5">{m}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

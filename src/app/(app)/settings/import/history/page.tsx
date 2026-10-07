import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Import history" };

const STATUS: Record<string, string> = {
  PENDING: "Not finished",
  PROCESSING: "Interrupted",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export default async function ImportHistory() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const batches = await prisma.importBatch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: settings.timezone });
  return (
    <>
      <PageHeader title="Import history" back="/settings" />
      {batches.length === 0 ? (
        <p className="panel p-6 text-center text-sm text-muted">No imports yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {batches.map((b) => (
            <li key={b.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{b.fileName}</p>
                  <p className="text-xs text-muted">
                    {fmt.format(b.createdAt)} · {b.format.toUpperCase()} · {b.source}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${b.status === "COMPLETED" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                  {STATUS[b.status]}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Cell label="New" value={b.createdCount} />
                <Cell label="Dupes" value={b.duplicateCount} />
                <Cell label="Updated" value={b.updatedCount} />
                <Cell label="Unassigned" value={b.unassignedCount} />
              </dl>
              {b.mediaCount > 0 && <p className="mt-2 text-xs text-muted">{b.mediaCount} images stored</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 py-1.5">
      <dd className="font-bold tabular-nums">{value.toLocaleString()}</dd>
      <dt className="text-[11px] text-muted">{label}</dt>
    </div>
  );
}

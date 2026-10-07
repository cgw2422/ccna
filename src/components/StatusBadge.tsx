import type { DayStatusValue } from "@/lib/ccna";

const STYLE: Record<DayStatusValue, string> = {
  ACTIVE: "bg-success-soft text-success",
  REVIEW_ONLY: "bg-warning-soft text-warning",
  PAUSED: "bg-paused-soft text-paused",
};
const LABEL: Record<DayStatusValue, string> = { ACTIVE: "Active", REVIEW_ONLY: "Review only", PAUSED: "Paused" };

export function StatusBadge({ status }: { status: DayStatusValue }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{LABEL[status]}</span>;
}

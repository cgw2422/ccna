import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="-ml-1.5 mb-1 inline-flex min-h-9 items-center gap-0.5 pr-2 text-sm font-semibold text-primary">
            <ChevronLeft className="size-5" /> Back
          </Link>
        )}
        <h1 className="truncate text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

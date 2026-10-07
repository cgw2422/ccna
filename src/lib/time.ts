// Timezone-aware "today" helpers. The study day rolls over at local midnight
// in the user's configured IANA timezone.

const MS_DAY = 86_400_000;

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Local calendar date (YYYY-MM-DD) of `date` in `timeZone`. */
export function localDateKey(date: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return dtf.format(date);
}

/** UTC instant of local midnight starting the day containing `date`. */
export function startOfLocalDay(date: Date, timeZone: string): Date {
  const key = localDateKey(date, timeZone);
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // Two passes handle DST transitions.
  let ts = guess - tzOffsetMs(new Date(guess), timeZone);
  ts = guess - tzOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

export function endOfLocalDay(date: Date, timeZone: string): Date {
  const start = startOfLocalDay(date, timeZone);
  const next = startOfLocalDay(new Date(start.getTime() + MS_DAY + 3 * 3_600_000), timeZone);
  return new Date(next.getTime() - 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_DAY);
}

/** Whole days from today's local date to a calendar date (YYYY-MM-DD or Date at UTC midnight). */
export function daysUntil(target: Date, now: Date, timeZone: string): number {
  const today = localDateKey(now, timeZone);
  const [y, m, d] = today.split("-").map(Number);
  const todayUtc = Date.UTC(y, m - 1, d);
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtc - todayUtc) / MS_DAY);
}

export function formatInterval(ms: number): string {
  const min = ms / 60_000;
  if (min < 1) return "<1m";
  if (min < 60) return `${Math.round(min)}m`;
  const hours = min / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(days < 300 ? 1 : 0).replace(/\.0$/, "")}mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, "")}y`;
}

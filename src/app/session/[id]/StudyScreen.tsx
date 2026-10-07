"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Undo2, X } from "lucide-react";
import type { SessionState } from "@/lib/study/session";

type Rating = 1 | 2 | 3 | 4;

const BUTTONS: { rating: Rating; label: string; className: string }[] = [
  { rating: 1, label: "Again", className: "bg-danger-soft text-danger" },
  { rating: 2, label: "Hard", className: "bg-warning-soft text-warning" },
  { rating: 3, label: "Good", className: "bg-success-soft text-success" },
  { rating: 4, label: "Easy", className: "bg-primary-soft text-easy" },
];

export function StudyScreen({
  initial,
  sessionName,
  autoShowAnswerSeconds,
}: {
  initial: SessionState;
  sessionName: string | null;
  autoShowAnswerSeconds: number | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>(initial);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef<number>(0);
  const scroller = useRef<HTMLDivElement>(null);
  const sessionId = initial.sessionId;
  const cardId = state.status === "card" ? state.card.id : null;

  useEffect(() => {
    shownAt.current = Date.now();
    setRevealed(false);
    scroller.current?.scrollTo({ top: 0 });
  }, [cardId, state.status === "card" ? state.done : -1]); // eslint-disable-line react-hooks/exhaustive-deps

  // Optional auto-reveal.
  useEffect(() => {
    if (!autoShowAnswerSeconds || state.status !== "card" || revealed) return;
    const t = setTimeout(() => setRevealed(true), autoShowAnswerSeconds * 1000);
    return () => clearTimeout(t);
  }, [autoShowAnswerSeconds, state, revealed]);

  const call = useCallback(
    async (path: string, body?: unknown) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/study/${sessionId}${path}`, {
          method: body === undefined && path === "" ? "GET" : "POST",
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Request failed");
        setState(data as SessionState);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error — try again");
      } finally {
        setBusy(false);
      }
    },
    [router, sessionId],
  );

  const answer = useCallback(
    (rating: Rating) => {
      if (state.status !== "card" || busy || !revealed) return;
      if (navigator.vibrate) navigator.vibrate(8);
      call("/answer", { cardId: state.card.id, rating, durationMs: Date.now() - shownAt.current });
    },
    [state, busy, revealed, call],
  );

  const undo = useCallback(() => {
    if (!busy && state.canUndo) call("/undo", {});
  }, [busy, state.canUndo, call]);

  // Keyboard shortcuts (desktop): space/enter reveal, 1–4 rate, z/u undo.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (state.status !== "card") return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        answer(Number(e.key) as Rating);
      } else if (revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        answer(3);
      } else if (e.key === "z" || e.key === "u") undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, revealed, answer, undo]);

  // Waiting for a learning card: poll when it becomes due.
  useEffect(() => {
    if (state.status !== "waiting") return;
    const ms = Math.max(1000, new Date(state.nextDue).getTime() - Date.now() + 500);
    const t = setTimeout(() => call(""), Math.min(ms, 60_000));
    return () => clearTimeout(t);
  }, [state, call]);

  const done = state.done;
  const total = state.status === "card" ? state.done + state.remaining : state.done;
  const pct = total ? Math.round((done / total) * 100) : 100;

  return (
    <div className="fixed inset-0 flex flex-col bg-bg">
      {/* Top bar */}
      <div className="pt-safe shrink-0 px-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <Link href="/" aria-label="End session" className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface-2">
            <X className="size-6" />
          </Link>
          <div className="flex-1 text-center">
            <p className="text-sm font-bold tabular-nums">{state.status === "card" ? `${done + 1} / ${total}` : `${done} / ${total}`}</p>
            {sessionName && <p className="text-[11px] font-medium text-muted">{sessionName}</p>}
          </div>
          <button
            onClick={undo}
            disabled={!state.canUndo || busy}
            aria-label="Undo last answer"
            className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface-2 disabled:opacity-30"
          >
            <Undo2 className="size-5" />
          </button>
        </div>
        <div className="mx-auto mt-1 h-1 max-w-2xl overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {state.status === "card" ? (
        <>
          <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto flex min-h-full max-w-2xl flex-col">
              <p className="mb-3 text-center text-xs font-semibold tracking-wide text-muted">
                {state.card.dayLabel}
                {state.card.kind === "new" && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-primary">New</span>}
              </p>
              <article
                className="panel flex flex-1 flex-col justify-center px-5 py-8 text-center shadow-sm"
                onClick={() => !revealed && setRevealed(true)}
              >
                <div className="card-content" dangerouslySetInnerHTML={{ __html: state.card.front }} />
                {revealed && (
                  <>
                    <hr className="my-6 border-border" />
                    <div className="card-content" dangerouslySetInnerHTML={{ __html: state.card.back }} />
                  </>
                )}
              </article>
            </div>
          </div>

          <div className="pb-safe shrink-0 border-t border-border bg-surface/90 px-3 pt-3 backdrop-blur">
            <div className="mx-auto max-w-2xl pb-3">
              {error && <p className="mb-2 text-center text-sm font-medium text-danger">{error}</p>}
              {!revealed ? (
                <button className="btn btn-primary min-h-16 w-full text-lg tracking-wide" onClick={() => setRevealed(true)}>
                  SHOW ANSWER
                </button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {BUTTONS.map((b) => (
                    <button
                      key={b.rating}
                      onClick={() => answer(b.rating)}
                      disabled={busy}
                      className={`flex min-h-16 flex-col items-center justify-center rounded-xl font-bold transition active:scale-95 disabled:opacity-60 ${b.className}`}
                    >
                      <span className="text-[15px] uppercase">{b.label}</span>
                      <span className="text-xs font-semibold opacity-75">{state.card.intervals[b.rating]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : state.status === "waiting" ? (
        <Centered>
          <Clock className="size-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Almost there</h1>
          <p className="mt-2 text-muted">
            Your next learning card is due <Countdown to={state.nextDue} />.
          </p>
          <button className="btn btn-primary mt-6 w-full" onClick={() => call("")} disabled={busy}>
            Check again
          </button>
          <Link href="/" className="btn btn-secondary mt-2 w-full">
            Back to Home
          </Link>
        </Centered>
      ) : (
        <Centered>
          <CheckCircle2 className="size-14 text-success" />
          <h1 className="mt-4 text-2xl font-bold">{done > 0 ? "Session complete" : "Nothing to study"}</h1>
          <p className="mt-2 text-muted">
            {done > 0
              ? `You reviewed ${done} ${done === 1 ? "card" : "cards"}. Nice work!`
              : "No cards are available with your current Study Plan and daily limits."}
          </p>
          <Link href="/" className="btn btn-primary mt-6 w-full">
            Back to Home
          </Link>
          <Link href="/study" className="btn btn-secondary mt-2 w-full">
            More study options
          </Link>
          {state.canUndo && (
            <button className="btn btn-ghost mt-2 w-full" onClick={undo} disabled={busy}>
              <Undo2 className="size-4" /> Undo last answer
            </button>
          )}
        </Centered>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 text-center">{children}</div>;
}

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((new Date(to).getTime() - now) / 1000));
  if (s <= 0) return <>now</>;
  const m = Math.floor(s / 60);
  return <>in {m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`}</>;
}

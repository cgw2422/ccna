import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { CardState, UserCardProgress } from "@prisma/client";

export const RATINGS = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 } as const;
export type RatingValue = 1 | 2 | 3 | 4;

const schedulers = new Map<number, ReturnType<typeof fsrs>>();

export function getScheduler(desiredRetention = 0.9) {
  const r = Math.min(0.97, Math.max(0.7, Math.round(desiredRetention * 100) / 100));
  let s = schedulers.get(r);
  if (!s) {
    s = fsrs(
      generatorParameters({
        request_retention: r,
        enable_fuzz: true,
        enable_short_term: true,
        learning_steps: ["1m", "10m"],
        relearning_steps: ["10m"],
        maximum_interval: 3650,
      }),
    );
    schedulers.set(r, s);
  }
  return s;
}

const toFsrsState: Record<CardState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};
const fromFsrsState: Record<State, CardState> = {
  [State.New]: "NEW",
  [State.Learning]: "LEARNING",
  [State.Review]: "REVIEW",
  [State.Relearning]: "RELEARNING",
};

export type ProgressFields = Pick<
  UserCardProgress,
  "state" | "due" | "stability" | "difficulty" | "elapsedDays" | "scheduledDays" | "learningSteps" | "reps" | "lapses" | "lastReview"
>;

export function progressToFsrs(p: ProgressFields | null, now: Date): FsrsCard {
  if (!p) return createEmptyCard(now);
  return {
    due: p.due,
    stability: p.stability,
    difficulty: p.difficulty,
    elapsed_days: p.elapsedDays,
    scheduled_days: p.scheduledDays,
    learning_steps: p.learningSteps,
    reps: p.reps,
    lapses: p.lapses,
    state: toFsrsState[p.state],
    last_review: p.lastReview ?? undefined,
  };
}

export function fsrsToProgress(c: FsrsCard): ProgressFields {
  return {
    state: fromFsrsState[c.state],
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: Math.round(c.elapsed_days),
    scheduledDays: Math.round(c.scheduled_days),
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    lastReview: c.last_review ?? null,
  };
}

export function schedule(p: ProgressFields | null, rating: RatingValue, now: Date, desiredRetention: number) {
  const f = getScheduler(desiredRetention);
  const { card, log } = f.next(progressToFsrs(p, now), now, rating as Grade);
  return { next: fsrsToProgress(card), log };
}

/** Interval previews for the four buttons, in ms from now. */
export function previewIntervals(p: ProgressFields | null, now: Date, desiredRetention: number): Record<RatingValue, number> {
  const f = getScheduler(desiredRetention);
  const preview = f.repeat(progressToFsrs(p, now), now);
  return {
    1: preview[Rating.Again].card.due.getTime() - now.getTime(),
    2: preview[Rating.Hard].card.due.getTime() - now.getTime(),
    3: preview[Rating.Good].card.due.getTime() - now.getTime(),
    4: preview[Rating.Easy].card.due.getTime() - now.getTime(),
  };
}

/** 0–1 mastery score for a card, used for day/domain mastery percentages. */
export function masteryScore(state: CardState | null, stability: number): number {
  if (!state || state === "NEW") return 0;
  if (state === "LEARNING" || state === "RELEARNING") return 0.2;
  return Math.min(1, 0.4 + 0.6 * (stability / 21));
}

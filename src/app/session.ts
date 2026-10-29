import { fsrs, createEmptyCard, Rating, type Card, type Grade } from "ts-fsrs";
import type { Item, Unit } from "../content/schema";
import { lessonKey, localDate, pointKey, type Progress, type StoredCard } from "./progress";

export type AppUnit = Unit & { theory: Record<string, string> };
export type Verdict = "correct" | "accepted" | "wrong";

export interface Session {
  kind: "lesson" | "review";
  unitId?: string;
  lesson?: number;
  /** Items still to answer; the head is the current one. */
  queue: Item[];
  /** Distinct items in the session. */
  size: number;
  /** First answer to each item: what spaced repetition and stats record. */
  firstTry: Record<string, Verdict>;
}

const scheduler = fsrs();
const REVIEW_MAX_ITEMS = 12;

export const unitOfItem = (itemId: string) => itemId.slice(0, 5);

export function lessonSession(unit: AppUnit, lesson: number): Session {
  const queue = unit.items.filter((it) => it.lesson === lesson);
  return { kind: "lesson", unitId: unit.id, lesson, queue, size: queue.length, firstTry: {} };
}

/** Records an answer to the current item. A wrong item comes back at the end until it is right. */
export function answer(s: Session, verdict: Verdict): Session {
  const [current, ...rest] = s.queue;
  if (!current) return s;
  const firstTry = current.id in s.firstTry ? s.firstTry : { ...s.firstTry, [current.id]: verdict };
  const queue = verdict === "wrong" ? [...rest, current] : rest;
  return { ...s, queue, firstTry };
}

/** Share of the session done, counting repeats of wrong items as extra work. */
export function sessionProgress(s: Session): number {
  const pendingRepeats = s.queue.filter((it) => it.id in s.firstTry).length;
  const total = s.size + pendingRepeats;
  return total === 0 ? 1 : (total - s.queue.length) / total;
}

/** Rating of each point in a finished session: the worst first answer decides. */
export function pointRatings(s: Session, items: Map<string, Item>): Map<string, Grade> {
  const out = new Map<string, Grade>();
  for (const [id, verdict] of Object.entries(s.firstTry)) {
    const item = items.get(id);
    if (!item) continue;
    const key = pointKey(unitOfItem(id), item.point);
    const rating = verdict === "wrong" ? Rating.Again : verdict === "accepted" ? Rating.Hard : Rating.Good;
    out.set(key, Math.min(out.get(key) ?? Rating.Good, rating) as Grade);
  }
  return out;
}

/** The progress after a finished session. */
export function applySession(p: Progress, s: Session, items: Map<string, Item>, now: Date): Progress {
  const stamp = now.toISOString();
  const itemStats = { ...p.items };
  for (const [id, verdict] of Object.entries(s.firstTry)) {
    const prev = itemStats[id] ?? { seen: 0, wrong: 0, last: stamp, ok: true };
    itemStats[id] = {
      seen: prev.seen + 1,
      wrong: prev.wrong + (verdict === "wrong" ? 1 : 0),
      last: stamp,
      ok: verdict !== "wrong",
    };
  }
  const cards = { ...p.cards };
  for (const [key, rating] of pointRatings(s, items)) {
    const card = cards[key] ?? createEmptyCard<Card>(now);
    const next = scheduler.next(card, now, rating).card;
    cards[key] = { ...next, due: next.due.toISOString(), last_review: next.last_review?.toISOString() ?? null } as StoredCard;
  }
  const lessons = { ...p.lessons };
  if (s.kind === "lesson" && s.unitId && s.lesson) {
    lessons[lessonKey(s.unitId, s.lesson)] ??= stamp;
  }
  const today = localDate(now);
  const days = p.days.includes(today) ? p.days : [...p.days, today];
  return { ...p, items: itemStats, cards, lessons, days };
}

/** Point keys whose review is due, most overdue first. */
export function duePoints(p: Progress, now: Date): string[] {
  return Object.entries(p.cards)
    .filter(([, c]) => new Date(c.due) <= now)
    .sort(([, a], [, b]) => Date.parse(a.due) - Date.parse(b.due))
    .map(([key]) => key);
}

/**
 * Items for a review of the due points: one per point (two when few are due),
 * preferring items last answered wrong, then the least seen, then the longest ago.
 */
export function reviewSession(units: AppUnit[], p: Progress, now: Date): Session {
  const due = duePoints(p, now);
  const perPoint = due.length < REVIEW_MAX_ITEMS / 2 ? 2 : 1;
  const queue: Item[] = [];
  for (const key of due) {
    const [unitId, pointId] = key.split("/");
    const unit = units.find((u) => u.id === unitId);
    if (!unit) continue;
    const stat = (it: Item) => p.items[it.id];
    const candidates = unit.items
      .filter((it) => it.point === pointId)
      .sort((a, b) => {
        const sa = stat(a);
        const sb = stat(b);
        const wrongFirst = Number(sa?.ok ?? true) - Number(sb?.ok ?? true);
        if (wrongFirst !== 0) return wrongFirst;
        const seen = (sa?.seen ?? 0) - (sb?.seen ?? 0);
        if (seen !== 0) return seen;
        return Date.parse(sa?.last ?? "1970") - Date.parse(sb?.last ?? "1970");
      });
    queue.push(...candidates.slice(0, perPoint));
    if (queue.length >= REVIEW_MAX_ITEMS) break;
  }
  const items = queue.slice(0, REVIEW_MAX_ITEMS);
  return { kind: "review", queue: items, size: items.length, firstTry: {} };
}

/** The first lesson not yet completed, in course order. */
export function nextLesson(units: AppUnit[], p: Progress): { unit: AppUnit; lesson: number } | null {
  for (const unit of units) {
    for (let n = 1; n <= unit.lessons.length; n++) {
      if (!p.lessons[lessonKey(unit.id, n)]) return { unit, lesson: n };
    }
  }
  return null;
}

export const lessonsDone = (unit: AppUnit, p: Progress) =>
  unit.lessons.filter((_, i) => p.lessons[lessonKey(unit.id, i + 1)]).length;

/**
 * The progress after a finished session, applied exactly once: when the
 * session id was already applied (crash between the write and the draft
 * cleanup, double tap) the progress is returned unchanged.
 */
export function finishSessionOnce(
  progress: Progress,
  session: Session,
  sessionId: string,
  items: Map<string, Item>,
  now: Date
): Progress {
  if (progress.lastAppliedSessionId === sessionId) return progress;
  return { ...applySession(progress, session, items, now), lastAppliedSessionId: sessionId };
}

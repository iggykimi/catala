import type { CardInput } from "ts-fsrs";

/** A spaced-repetition card as stored (dates as ISO strings). */
export type StoredCard = Omit<CardInput, "due" | "last_review"> & { due: string; last_review?: string | null };

export interface ItemStat {
  seen: number;
  wrong: number;
  /** ISO time of the last answer. */
  last: string;
  /** Whether the last first-try answer was right. */
  ok: boolean;
}

export interface Progress {
  v: 1;
  /** "unitId#lesson" → ISO time first completed. */
  lessons: Record<string, string>;
  /** "unitId/pointId" → FSRS card. */
  cards: Record<string, StoredCard>;
  items: Record<string, ItemStat>;
  /** Local dates (YYYY-MM-DD) with at least one finished session. */
  days: string[];
  /** Item ids the learner marked as suspicious. */
  flagged: string[];
}

const KEY = "catala.progress.v1";

export const emptyProgress = (): Progress => ({ v: 1, lessons: {}, cards: {}, items: {}, days: [], flagged: [] });

/** Parses a stored or pasted progress; null if it is not one. */
export function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Progress>;
    if (p.v !== 1 || typeof p.lessons !== "object" || typeof p.cards !== "object") return null;
    return { ...emptyProgress(), ...p } as Progress;
  } catch {
    return null;
  }
}

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(KEY)) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export const lessonKey = (unitId: string, lesson: number) => `${unitId}#${lesson}`;
export const pointKey = (unitId: string, pointId: string) => `${unitId}/${pointId}`;

export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Consecutive days with activity, ending today or yesterday. */
export function streak(days: string[], now: Date): number {
  const set = new Set(days);
  const d = new Date(now);
  if (!set.has(localDate(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(localDate(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

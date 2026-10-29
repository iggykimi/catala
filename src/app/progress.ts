import { z } from "zod";
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
  /** Id of the last session applied by finishSessionOnce (crash/double-tap guard). */
  lastAppliedSessionId?: string;
  /** Generation id: full replacements mint a new one so stale drafts never resume. */
  progressEpoch?: string;
}

export const PROGRESS_KEY = "catala.progress.v1";
/** One-shot shelter for stored bytes that are no longer a valid progress. */
export const CORRUPT_BACKUP_KEY = "catala.progress.corrupt.v1";

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");
const nonNegativeInt = z.number().int().nonnegative();
const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const itemStatSchema = z.object({
  seen: nonNegativeInt,
  wrong: nonNegativeInt,
  last: isoDateTime,
  ok: z.boolean(),
});

// Card fields follow the installed ts-fsrs Card model (due, stability, difficulty,
// elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review).
// Unknown extra keys are kept so a future ts-fsrs field never invalidates a copy.
const storedCardSchema = z
  .object({
    due: isoDateTime,
    last_review: isoDateTime.nullish(),
    stability: z.number().finite().nonnegative(),
    difficulty: z.number().finite().nonnegative(),
    elapsed_days: z.number().finite(),
    scheduled_days: z.number().finite(),
    learning_steps: nonNegativeInt,
    reps: nonNegativeInt,
    lapses: nonNegativeInt,
    state: z.union([z.number().int().min(0).max(3), z.enum(["New", "Learning", "Review", "Relearning"])]),
  })
  .passthrough();

// Strict about shapes, lenient about age: fields added after v1 shipped get
// defaults so old but legitimate copies still validate (see the compat test).
const progressSchema = z.object({
  v: z.literal(1),
  lessons: z.record(z.string(), isoDateTime),
  cards: z.record(z.string(), storedCardSchema),
  items: z.record(z.string(), itemStatSchema).default({}),
  days: z.array(dayString).default([]),
  flagged: z.array(z.string()).default([]),
  lastAppliedSessionId: z.string().optional(),
  progressEpoch: z.string().optional(),
});

export const emptyProgress = (): Progress => ({ v: 1, lessons: {}, cards: {}, items: {}, days: [], flagged: [] });

/** Mints a fresh progress generation id for full replacements (wipe/restore/import). */
export function newProgressEpoch(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Fall through to the Math.random fallback below.
  }
  return `epoch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Whether a draft belongs to the current progress generation. Strict equality:
 * undefined matches only undefined, so legacy data on both sides stays valid
 * while any one-sided epoch marks the draft as stale.
 */
export function epochsMatch(draftEpoch: string | undefined, currentEpoch: string | undefined): boolean {
  return draftEpoch === currentEpoch;
}

/** Parses a stored or pasted progress; null if it is not one. */
export function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const result = progressSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    return result.data as Progress;
  } catch {
    return null;
  }
}

/** Keeps the first corrupt snapshot; later ones never overwrite it. */
function stashCorruptBackup(raw: string): void {
  try {
    if (localStorage.getItem(CORRUPT_BACKUP_KEY) === null) {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
    }
  } catch {
    // Storage unavailable: nothing can be preserved.
  }
}

/** The sheltered corrupt bytes, if any were ever stashed. */
export function readCorruptBackup(): string | null {
  try {
    return localStorage.getItem(CORRUPT_BACKUP_KEY);
  } catch {
    return null;
  }
}

export interface ProgressLoad {
  progress: Progress;
  /** The stored bytes when they exist but are not a valid progress, else null. */
  corrupt: string | null;
}

/**
 * Loads the progress telling apart "nothing stored" (corrupt: null) from
 * "stored but unreadable" (corrupt: raw bytes, sheltered under the backup key).
 */
export function loadProgressState(): ProgressLoad {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PROGRESS_KEY);
  } catch {
    return { progress: emptyProgress(), corrupt: null };
  }
  if (raw === null) return { progress: emptyProgress(), corrupt: null };
  const parsed = parseProgress(raw);
  if (parsed) return { progress: parsed, corrupt: null };
  stashCorruptBackup(raw);
  return { progress: emptyProgress(), corrupt: raw };
}

export function loadProgress(): Progress {
  return loadProgressState().progress;
}

export function saveProgress(p: Progress): void {
  // Never silently pave over bytes we cannot read: shelter them first.
  try {
    const existing = localStorage.getItem(PROGRESS_KEY);
    if (existing !== null && parseProgress(existing) === null) stashCorruptBackup(existing);
  } catch {
    // A failing read must not block the write below.
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
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

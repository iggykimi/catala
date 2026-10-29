import { z } from "zod";
import type { Item } from "../content/schema";
import { epochsMatch } from "./progress";
import type { Session } from "./session";

export const DRAFT_KEY = "catala.session.v1";

const verdictSchema = z.enum(["correct", "accepted", "wrong"]);
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const draftSchema = z.object({
  v: z.literal(1),
  id: z.string().min(1),
  savedAt: isoDateTime,
  kind: z.enum(["lesson", "review"]),
  unitId: z.string().optional(),
  lesson: z.number().int().positive().optional(),
  /** Remaining item ids, in queue order (repeats included). Full items are never stored. */
  queueIds: z.array(z.string()).min(1),
  /** Distinct items in the session. */
  size: z.number().int().positive(),
  firstTry: z.record(z.string(), verdictSchema),
  /** Progress generation the draft belongs to; absent on legacy drafts. */
  progressEpoch: z.string().optional(),
});

export type SessionDraft = z.infer<typeof draftSchema>;

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Fall through to the Math.random fallback below.
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDraft(session: Session, epoch?: string): SessionDraft {
  return {
    v: 1,
    id: newId(),
    savedAt: new Date().toISOString(),
    kind: session.kind,
    unitId: session.unitId,
    lesson: session.lesson,
    queueIds: session.queue.map((item) => item.id),
    size: session.size,
    firstTry: { ...session.firstTry },
    ...(epoch !== undefined ? { progressEpoch: epoch } : {}),
  };
}

/**
 * Stores the session checkpoint tagged with the current progress generation.
 * Returns false when the write fails (quota, unavailable storage) so the app
 * can warn that the session is not recoverable.
 */
export function saveDraft(id: string, session: Session, epoch?: string): boolean {
  const draft: SessionDraft = {
    v: 1,
    id,
    savedAt: new Date().toISOString(),
    kind: session.kind,
    unitId: session.unitId,
    lesson: session.lesson,
    queueIds: session.queue.map((item) => item.id),
    size: session.size,
    firstTry: { ...session.firstTry },
    ...(epoch !== undefined ? { progressEpoch: epoch } : {}),
  };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function readStored(): SessionDraft | "none" | "unusable" {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return "none";
  }
  if (!raw) return "none";
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : "unusable";
  } catch {
    return "unusable";
  }
}

/** Rebuilds the session only if every id belongs to the current content. */
function toSession(draft: SessionDraft, items: Map<string, Item>): Session | null {
  const queue = draft.queueIds.map((id) => items.get(id));
  if (queue.some((item) => !item)) return null;
  const answeredIds = Object.keys(draft.firstTry);
  if (answeredIds.some((id) => !items.has(id))) return null;
  const distinctIds = new Set([...draft.queueIds, ...answeredIds]);
  if (distinctIds.size !== draft.size) return null;
  if (draft.kind === "lesson") {
    if (!draft.unitId || !draft.lesson) return null;
    const belongsToLesson = (item: Item) => item.id.startsWith(`${draft.unitId}-`) && item.lesson === draft.lesson;
    for (const id of distinctIds) {
      const item = items.get(id);
      if (!item || !belongsToLesson(item)) return null;
    }
  }
  return {
    kind: draft.kind,
    unitId: draft.unitId,
    lesson: draft.lesson,
    queue: queue as Item[],
    size: draft.size,
    firstTry: draft.firstTry,
  };
}

export type DraftStatus = "none" | "valid" | "unusable";

/**
 * Whether a restorable draft exists. A draft from another progress generation
 * reports "unusable". Never deletes or repairs anything.
 */
export function draftStatus(items: Map<string, Item>, currentEpoch?: string): DraftStatus {
  const stored = readStored();
  if (stored === "none" || stored === "unusable") return stored;
  if (!toSession(stored, items)) return "unusable";
  return epochsMatch(stored.progressEpoch, currentEpoch) ? "valid" : "unusable";
}

/**
 * Restores the draft checkpoint, or null when there is none, it is unusable,
 * or it belongs to another progress generation.
 */
export function loadDraft(items: Map<string, Item>, currentEpoch?: string): { id: string; session: Session } | null {
  const stored = readStored();
  if (stored === "none" || stored === "unusable") return null;
  const session = toSession(stored, items);
  if (!session) return null;
  if (!epochsMatch(stored.progressEpoch, currentEpoch)) return null;
  return { id: stored.id, session };
}

/** Removes the draft only if it is still the given session's. Unknown data is left untouched. */
export function clearDraft(id: string): void {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw) as { id?: string };
    if (stored.id === id) localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Leave unknown data untouched.
  }
}

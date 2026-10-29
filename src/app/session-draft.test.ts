import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "../content/schema";
import {
  CORRUPT_BACKUP_KEY,
  emptyProgress,
  epochsMatch,
  loadProgressState,
  newProgressEpoch,
  parseProgress,
  PROGRESS_KEY,
  readCorruptBackup,
  saveProgress,
} from "./progress";
import { answer, applySession, finishSessionOnce, lessonSession, type AppUnit } from "./session";
import { clearDraft, createDraft, DRAFT_KEY, draftStatus, loadDraft, saveDraft } from "./session-draft";

// No jsdom here (see vitest.config.ts), so localStorage is stubbed in-file.
function installStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string): string | null => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string): void => {
      store.set(key, String(value));
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    clear: (): void => {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key: (i: number): string | null => [...store.keys()][i] ?? null,
  });
}

const item = (n: number, point: string, lesson = 1): Item => ({
  id: `a2-01-${String(n).padStart(3, "0")}`,
  type: "choice",
  point,
  lesson,
  explanation: "x",
  prompt: "___",
  answer: "a",
  distractors: [{ text: "b" }, { text: "c" }],
});

// A twelve-exercise lesson to mirror the issue's example.
const unit: AppUnit = {
  id: "a2-01",
  level: "A2",
  title: "U",
  summary: "s",
  vocabulary_theme: "v",
  vocabulary: [],
  theory: {},
  points: [{ id: "p", title: "P", refs: [] }],
  lessons: [{ title: "L1" }],
  items: Array.from({ length: 12 }, (_, i) => item(i + 1, "p")),
};
const index = new Map(unit.items.map((it) => [it.id, it]));
const ids = (queue: Item[]): string[] => queue.map((it) => it.id);

beforeEach(() => {
  vi.unstubAllGlobals();
  installStorage();
});

describe("session drafts", () => {
  it("saves a new session", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    expect(saveDraft(draft.id, session)).toBe(true);
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toMatchObject({ v: 1, id: draft.id, kind: "lesson", size: 12 });
    expect(JSON.parse(raw!).queueIds).toHaveLength(12);
  });

  it("restores the same queue order and first tries", () => {
    let session = lessonSession(unit, 1);
    session = answer(session, "wrong");
    session = answer(session, "correct");
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    const restored = loadDraft(index);
    expect(restored?.id).toBe(draft.id);
    expect(restored && ids(restored.session.queue)).toEqual(ids(session.queue));
    expect(restored?.session.firstTry).toEqual(session.firstTry);
  });

  it("saves after five exercises", () => {
    let session = lessonSession(unit, 1);
    for (let i = 0; i < 5; i++) session = answer(session, "correct");
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    const restored = loadDraft(index);
    expect(restored?.id).toBe(draft.id);
    expect(restored && ids(restored.session.queue)).toEqual(ids(session.queue));
    expect(Object.keys(restored!.session.firstTry)).toHaveLength(5);
    expect(restored!.session.queue).toHaveLength(7);
  });

  it("keeps pending repeats", () => {
    let session = lessonSession(unit, 1);
    session = answer(session, "wrong");
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    const restored = loadDraft(index);
    // The failed item is back at the end and still counts as answered-wrong.
    expect(restored && ids(restored.session.queue)).toEqual(ids(session.queue));
    expect(restored!.session.queue.at(-1)!.id).toBe("a2-01-001");
    expect(restored!.session.firstTry["a2-01-001"]).toBe("wrong");
  });

  it("rejects unknown ids without touching the stored bytes", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    const tampered = { ...JSON.parse(localStorage.getItem(DRAFT_KEY)!), queueIds: ["zz-99-999"] };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(tampered));
    expect(loadDraft(index)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBe(JSON.stringify(tampered));

    const tamperedFirst = {
      ...JSON.parse(localStorage.getItem(DRAFT_KEY)!),
      queueIds: ids(session.queue),
      firstTry: { "zz-99-999": "correct" },
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(tamperedFirst));
    expect(loadDraft(index)).toBeNull();
  });

  it("rejects invalid structure without wiping it", () => {
    localStorage.setItem(DRAFT_KEY, "{oops");
    expect(loadDraft(index)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBe("{oops");

    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1 }));
    expect(loadDraft(index)).toBeNull();
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toEqual({ v: 1 });
  });

  it("does not duplicate stats when finished twice", () => {
    let session = lessonSession(unit, 1);
    while (session.queue.length > 0) session = answer(session, "correct");
    const now = new Date("2026-10-20T09:00:00.000Z");
    const first = finishSessionOnce(emptyProgress(), session, "s1", index, now);
    const second = finishSessionOnce(first, session, "s1", index, now);
    expect(second).toBe(first);
    expect(second.items["a2-01-001"]).toMatchObject({ seen: 1, wrong: 0 });
    expect(second.cards["a2-01/p"]?.reps).toBe(1);
    expect(second.days).toEqual(first.days);
  });

  it("clears the draft when finished", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    clearDraft(draft.id);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("does not clear another session's draft", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    clearDraft("someone-else");
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toMatchObject({ id: draft.id });
  });

  it("detects an already applied session", () => {
    let session = lessonSession(unit, 1);
    while (session.queue.length > 0) session = answer(session, "correct");
    const now = new Date("2026-10-20T09:00:00.000Z");
    // Last checkpoint before the final answer; progress was then written
    // but the app crashed before the draft was cleared.
    let partial = lessonSession(unit, 1);
    for (let i = 0; i < 11; i++) partial = answer(partial, "correct");
    const draft = createDraft(partial);
    saveDraft(draft.id, partial);
    const applied = finishSessionOnce(emptyProgress(), session, draft.id, index, now);
    expect(loadDraft(index)?.id).toBe(draft.id);
    expect(finishSessionOnce(applied, session, draft.id, index, now)).toBe(applied);
  });
});

describe("progress compatibility", () => {
  const finishFresh = () => {
    let session = lessonSession(unit, 1);
    while (session.queue.length > 0) session = answer(session, "correct");
    return applySession(emptyProgress(), session, index, new Date("2026-10-20T09:00:00.000Z"));
  };

  it("accepts an old-shape copy without newer fields", () => {
    const fresh = finishFresh();
    const old = { v: 1, lessons: fresh.lessons, cards: fresh.cards, items: fresh.items, days: fresh.days };
    const parsed = parseProgress(JSON.stringify(old));
    expect(parsed).not.toBeNull();
    expect(parsed!.flagged).toEqual([]);
    expect(parsed!.lastAppliedSessionId).toBeUndefined();
  });

  it("migrates a minimal old copy with defaults", () => {
    const fresh = finishFresh();
    const parsed = parseProgress(JSON.stringify({ v: 1, lessons: fresh.lessons, cards: fresh.cards }));
    expect(parsed).not.toBeNull();
    expect(parsed!.items).toEqual({});
    expect(parsed!.days).toEqual([]);
    expect(parsed!.flagged).toEqual([]);
  });

  it("shelters corrupt bytes instead of silently resetting", () => {
    localStorage.setItem(PROGRESS_KEY, "{oops");
    const state = loadProgressState();
    expect(state.progress).toEqual(emptyProgress());
    expect(state.corrupt).toBe("{oops");
    expect(readCorruptBackup()).toBe("{oops");
    expect(localStorage.getItem(PROGRESS_KEY)).toBe("{oops");
  });

  it("keeps the first corrupt backup", () => {
    localStorage.setItem(CORRUPT_BACKUP_KEY, "first");
    localStorage.setItem(PROGRESS_KEY, "second");
    expect(loadProgressState().corrupt).toBe("second");
    expect(readCorruptBackup()).toBe("first");
  });

  it("never overwrites corrupt data without a backup", () => {
    localStorage.setItem(PROGRESS_KEY, "{oops");
    saveProgress(emptyProgress());
    expect(readCorruptBackup()).toBe("{oops");
    expect(parseProgress(localStorage.getItem(PROGRESS_KEY))).toEqual(emptyProgress());
  });
});

describe("progress epoch", () => {
  it("restores a draft saved under the current epoch", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session, "epoch-1");
    expect(draft.progressEpoch).toBe("epoch-1");
    expect(saveDraft(draft.id, session, "epoch-1")).toBe(true);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!)).toMatchObject({ progressEpoch: "epoch-1" });
    expect(loadDraft(index, "epoch-1")?.id).toBe(draft.id);
    expect(draftStatus(index, "epoch-1")).toBe("valid");
  });

  it("rejects a previous-epoch draft without touching the stored bytes", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session, "epoch-1");
    saveDraft(draft.id, session, "epoch-1");
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(loadDraft(index, "epoch-2")).toBeNull();
    expect(draftStatus(index, "epoch-2")).toBe("unusable");
    expect(localStorage.getItem(DRAFT_KEY)).toBe(raw);
  });

  it("treats a one-sided epoch as a mismatch", () => {
    const session = lessonSession(unit, 1);
    // Legacy draft (no epoch) against a current epoch.
    const legacy = createDraft(session);
    saveDraft(legacy.id, session);
    expect(loadDraft(index, "epoch-1")).toBeNull();
    expect(draftStatus(index, "epoch-1")).toBe("unusable");
    // Epoch draft against a legacy progress (no epoch).
    const fresh = createDraft(session, "epoch-1");
    saveDraft(fresh.id, session, "epoch-1");
    expect(loadDraft(index)).toBeNull();
    expect(draftStatus(index)).toBe("unusable");
  });

  it("keeps legacy drafts valid when neither side has an epoch", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    expect(draft.progressEpoch).toBeUndefined();
    saveDraft(draft.id, session);
    expect(loadDraft(index)?.id).toBe(draft.id);
    expect(draftStatus(index)).toBe("valid");
  });

  it("matches epochs by strict equality", () => {
    expect(epochsMatch(undefined, undefined)).toBe(true);
    expect(epochsMatch("a", "a")).toBe(true);
    expect(epochsMatch("a", "b")).toBe(false);
    expect(epochsMatch(undefined, "a")).toBe(false);
    expect(epochsMatch("a", undefined)).toBe(false);
  });

  it("mints unique non-empty epochs", () => {
    const a = newProgressEpoch();
    const b = newProgressEpoch();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("progress epoch compatibility", () => {
  it("accepts old copies without progressEpoch", () => {
    const parsed = parseProgress(JSON.stringify({ v: 1, lessons: {}, cards: {} }));
    expect(parsed).not.toBeNull();
    expect(parsed!.progressEpoch).toBeUndefined();
  });

  it("round-trips copies with progressEpoch", () => {
    const parsed = parseProgress(JSON.stringify({ v: 1, lessons: {}, cards: {}, progressEpoch: "epoch-1" }));
    expect(parsed?.progressEpoch).toBe("epoch-1");
  });
});

describe("unusable drafts", () => {
  it("reports malformed JSON as unusable without touching it", () => {
    localStorage.setItem(DRAFT_KEY, "{oops");
    expect(draftStatus(index)).toBe("unusable");
    expect(loadDraft(index)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBe("{oops");
  });

  it("reports unknown ids as unusable without touching them", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    const tampered = { ...JSON.parse(localStorage.getItem(DRAFT_KEY)!), queueIds: ["zz-99-999"] };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(tampered));
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(draftStatus(index)).toBe("unusable");
    expect(loadDraft(index)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBe(raw);
  });

  it("reports a bad draft version as unusable without touching it", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    const tampered = { ...JSON.parse(localStorage.getItem(DRAFT_KEY)!), v: 2 };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(tampered));
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(draftStatus(index)).toBe("unusable");
    expect(loadDraft(index)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBe(raw);
  });

  it("reports changed-lesson membership as unusable without touching it", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session);
    saveDraft(draft.id, session);
    // The lesson's exercises changed: the draft now claims lesson 2 while
    // every stored item still belongs to lesson 1.
    const tampered = { ...JSON.parse(localStorage.getItem(DRAFT_KEY)!), lesson: 2 };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(tampered));
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(draftStatus(index)).toBe("unusable");
    expect(loadDraft(index)).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBe(raw);
  });

  it("reports a previous-epoch draft as unusable without touching it", () => {
    const session = lessonSession(unit, 1);
    const draft = createDraft(session, "epoch-1");
    saveDraft(draft.id, session, "epoch-1");
    const raw = localStorage.getItem(DRAFT_KEY);
    expect(draftStatus(index, "epoch-2")).toBe("unusable");
    expect(loadDraft(index, "epoch-2")).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBe(raw);
  });
});

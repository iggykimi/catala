import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "../content/schema";
import {
  CORRUPT_BACKUP_KEY,
  emptyProgress,
  loadProgressState,
  parseProgress,
  PROGRESS_KEY,
  readCorruptBackup,
  saveProgress,
} from "./progress";
import { answer, applySession, finishSessionOnce, lessonSession, type AppUnit } from "./session";
import { clearDraft, createDraft, DRAFT_KEY, loadDraft, saveDraft } from "./session-draft";

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

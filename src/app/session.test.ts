import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import type { Item } from "../content/schema";
import { emptyProgress, streak } from "./progress";
import { answer, applySession, duePoints, lessonSession, nextLesson, pointRatings, reviewSession, type AppUnit } from "./session";

const item = (n: number, point: string, lesson = 1): Item => ({
  id: `a2-01-00${n}`, type: "choice", point, lesson, explanation: "x",
  prompt: "___", answer: "a", distractors: [{ text: "b" }, { text: "c" }],
});

const unit: AppUnit = {
  id: "a2-01", level: "A2", title: "U", summary: "s", vocabulary_theme: "v", vocabulary: [], theory: {},
  points: [{ id: "p", title: "P", refs: [] }, { id: "q", title: "Q", refs: [] }],
  lessons: [{ title: "L1" }, { title: "L2" }],
  items: [item(1, "p"), item(2, "q"), item(3, "p"), item(4, "q", 2)],
};
const index = new Map(unit.items.map((it) => [it.id, it]));

describe("lesson session", () => {
  it("brings a wrong item back at the end and keeps its first answer", () => {
    let s = lessonSession(unit, 1);
    s = answer(s, "wrong");
    expect(s.queue.map((it) => it.id)).toEqual(["a2-01-002", "a2-01-003", "a2-01-001"]);
    s = answer(answer(answer(s, "correct"), "correct"), "correct");
    expect(s.queue).toEqual([]);
    expect(s.firstTry["a2-01-001"]).toBe("wrong");
  });

  it("rates each point by its worst first answer", () => {
    let s = lessonSession(unit, 1);
    s = answer(answer(answer(s, "correct"), "accepted"), "wrong");
    s = answer(s, "correct");
    const r = pointRatings(s, index);
    expect(r.get("a2-01/p")).toBe(Rating.Again);
    expect(r.get("a2-01/q")).toBe(Rating.Hard);
  });
});

describe("progress over time", () => {
  const day0 = new Date("2026-10-20T09:00:00");

  it("completes the lesson, moves to the next one and schedules a failed point first", () => {
    let s = lessonSession(unit, 1);
    s = answer(answer(answer(s, "wrong"), "correct"), "correct");
    s = answer(s, "correct");
    const p = applySession(emptyProgress(), s, index, day0);
    expect(nextLesson([unit], p)).toEqual({ unit, lesson: 2 });
    expect(p.items["a2-01-001"]).toMatchObject({ seen: 1, wrong: 1, ok: false });
    expect(Date.parse(p.cards["a2-01/p"]!.due)).toBeLessThan(Date.parse(p.cards["a2-01/q"]!.due));
  });

  it("reviews due points with the items last answered wrong first", () => {
    let s = lessonSession(unit, 1);
    s = answer(answer(answer(s, "correct"), "correct"), "wrong");
    s = answer(s, "correct");
    const p = applySession(emptyProgress(), s, index, day0);
    const later = new Date("2026-11-30T09:00:00");
    expect(duePoints(p, later).sort()).toEqual(["a2-01/p", "a2-01/q"]);
    const review = reviewSession([unit], p, later);
    expect(review.queue.filter((it) => it.point === "p")[0]!.id).toBe("a2-01-003");
  });

  it("counts a streak that ends yesterday", () => {
    expect(streak(["2026-10-18", "2026-10-19"], new Date("2026-10-20T09:00:00"))).toBe(2);
    expect(streak(["2026-10-17"], new Date("2026-10-20T09:00:00"))).toBe(0);
  });
});

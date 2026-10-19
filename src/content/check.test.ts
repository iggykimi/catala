import { describe, expect, it } from "vitest";
import { checkUnit } from "./check";
import { Unit } from "./schema";

const unit = (items: unknown[]) =>
  Unit.parse({
    id: "b1-13",
    level: "B1",
    title: "Prova",
    summary: "Prova",
    vocabulary_theme: "Prova",
    points: [{ id: "en-hi", title: "En i hi" }],
    lessons: [{ title: "Lliçó 1" }],
    items,
  });

const errors = (u: Unit) => checkUnit(u).filter((i) => i.severity === "error").map((i) => i.message);

describe("checkUnit", () => {
  it("rejects tolerant grading when a wrong answer differs from the answer only in accents", () => {
    const u = unit([
      {
        id: "b1-13-001", type: "fill", point: "en-hi", lesson: 1, explanation: "x",
        prompt: "No sé ___ vols.", hint: "pronom interrogatiu", grading: "tolerant",
        answers: ["què"], wrong_answers: [{ text: "que" }],
      },
    ]);
    expect(errors(u)).toContainEqual(expect.stringContaining("grading must be strict"));
  });

  it("rejects an order answer that does not use exactly the chunks", () => {
    const u = unit([
      {
        id: "b1-13-001", type: "order", point: "en-hi", lesson: 1, explanation: "x", cue: "x",
        chunks: ["no", "en", "tinc", "cap"], answers: ["No en tinc cap.", "No en tinc gens."],
      },
    ]);
    expect(errors(u)).toContainEqual(expect.stringContaining("does not use exactly the chunks"));
  });

  it("accepts an order answer whose comma lands elsewhere after reordering", () => {
    const u = unit([
      {
        id: "b1-13-001", type: "order", point: "en-hi", lesson: 1, explanation: "x", cue: "x",
        chunks: ["En sortir,", "el Jordi", "va trucar"],
        answers: ["En sortir, el Jordi va trucar.", "El Jordi va trucar en sortir."],
      },
    ]);
    expect(errors(u)).toEqual([]);
  });

  it("rejects a choice whose distractor equals the answer", () => {
    const u = unit([
      {
        id: "b1-13-001", type: "choice", point: "en-hi", lesson: 1, explanation: "x",
        prompt: "___ vaig ahir.", answer: "Hi", distractors: [{ text: "hi" }, { text: "En" }],
      },
    ]);
    expect(errors(u)).toContainEqual(expect.stringContaining("options repeat"));
  });
});

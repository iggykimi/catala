import { describe, expect, it } from "vitest";
import { gradeTyped, normalize } from "./grade";

describe("normalize", () => {
  it("ignores case, end punctuation, spacing and apostrophe / l·l variants", () => {
    expect(normalize("  L’home   s'ha  COL.LOCAT. ")).toBe(normalize("l'home s'ha col·locat"));
    expect(normalize("iŀlusió")).toBe("il·lusió");
    expect(normalize("¿On vas?")).toBe("on vas");
  });
});

describe("gradeTyped", () => {
  const fill = { answers: ["menjarem"], grading: "tolerant" as const };

  it("accepts every listed answer and reports which one matched", () => {
    const r = gradeTyped("ho vull fer", { answers: ["Vull fer-ho.", "Ho vull fer."], grading: "strict" });
    expect(r).toEqual({ verdict: "correct", expected: "Ho vull fer." });
  });

  it("strict: an accent slip is wrong", () => {
    expect(gradeTyped("que", { answers: ["què"], grading: "strict" }).verdict).toBe("wrong");
  });

  it("tolerant: an accent slip passes with a warning", () => {
    expect(gradeTyped("canco", { answers: ["cançó"], grading: "tolerant" })).toEqual({
      verdict: "accepted",
      expected: "cançó",
      notes: ["accent"],
    });
  });

  it("tolerant: a one-letter change in the word the learner produces is wrong (it may be another form)", () => {
    expect(gradeTyped("menjareu", fill).verdict).toBe("wrong");
  });

  it("tolerant: a typo in a word copied from the source passes; a typo in the transformed part does not", () => {
    const spec = {
      source: "Dono [[el llibre]] a la Montserrat.",
      answers: ["El dono a la Montserrat."],
      grading: "tolerant" as const,
    };
    expect(gradeTyped("El dono a la Monsterrat", spec)).toMatchObject({ verdict: "accepted", notes: ["typo"] });
    expect(gradeTyped("Li dono a la Montserrat", spec).verdict).toBe("wrong");
  });

  it("a known wrong answer is wrong with its feedback, also when typed with an accent slip", () => {
    const spec = {
      answers: ["he de"],
      wrong_answers: [{ text: "tinc que", why: "Obligació: haver de + infinitiu." }],
      grading: "tolerant" as const,
    };
    expect(gradeTyped("Tinc que", spec)).toEqual({ verdict: "wrong", expected: "he de", why: "Obligació: haver de + infinitiu." });
    expect(gradeTyped("tínc que", spec)).toMatchObject({ verdict: "wrong", why: "Obligació: haver de + infinitiu." });
  });
});

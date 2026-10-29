import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Item } from "../content/schema";
import { Exercise, matchCompletion, QuestionFeedback, Reading, typedResult } from "./exercises";

const noop = () => {};

describe("typedResult", () => {
  it("returns a bare correct verdict with no submitted text", () => {
    expect(typedResult("casa", { answers: ["casa"], grading: "tolerant" })).toEqual({ verdict: "correct" });
  });

  it("attaches the submitted text to accepted answers", () => {
    expect(typedResult("tingues", { answers: ["tingués"], grading: "tolerant" })).toEqual({
      verdict: "accepted",
      submitted: "tingues",
      expected: "tingués",
      notes: ["accent"],
    });
  });

  it("attaches the full submitted phrase for transform answers", () => {
    const full = "Si jo tingues temps";
    expect(typedResult(full, { answers: ["Si jo tingués temps"], grading: "tolerant" })).toEqual({
      verdict: "accepted",
      submitted: full,
      expected: "Si jo tingués temps",
      notes: ["accent"],
    });
  });

  it("attaches the submitted text and the known why to wrong answers", () => {
    expect(
      typedResult("menjo", { answers: ["menja"], wrong_answers: [{ text: "menjo", why: "Primera persona." }], grading: "tolerant" }),
    ).toEqual({ verdict: "wrong", submitted: "menjo", expected: "menja", why: "Primera persona." });
  });

  it("attaches the submitted text to plain wrong answers", () => {
    expect(typedResult("zzz", { answers: ["casa"], grading: "strict" })).toEqual({
      verdict: "wrong",
      submitted: "zzz",
      expected: "casa",
      why: undefined,
    });
  });
});

describe("matchCompletion", () => {
  it("passes a flawless run", () => {
    expect(matchCompletion(0)).toEqual({ verdict: "correct" });
  });

  it("uses the singular form for one mistake", () => {
    expect(matchCompletion(1)).toEqual({
      verdict: "wrong",
      why: "Has completat totes les parelles, però has fet 1 intent incorrecte.",
    });
  });

  it("uses the plural form for several mistakes", () => {
    expect(matchCompletion(3)).toEqual({
      verdict: "wrong",
      why: "Has completat totes les parelles, però has fet 3 intents incorrectes.",
    });
  });
});

describe("QuestionFeedback", () => {
  const options = [
    { text: "Resposta A", ok: false, why: "Perquè **així**." },
    { text: "Resposta B", ok: true },
  ];

  it("marks a right choice without repeating the answer", () => {
    const html = renderToStaticMarkup(createElement(QuestionFeedback, { options, selected: 1, answer: "Resposta B" }));
    expect(html).toContain("question-feedback is-correct");
    expect(html).toContain("Correcte");
    expect(html).not.toContain("Resposta correcta:");
  });

  it("names the right answer and the distractor why for a wrong choice", () => {
    const html = renderToStaticMarkup(createElement(QuestionFeedback, { options, selected: 0, answer: "Resposta B" }));
    expect(html).toContain("question-feedback is-incorrect");
    expect(html).toContain("Resposta incorrecta");
    expect(html).toContain("correct-answer");
    expect(html).toContain("Resposta correcta:");
    expect(html).toContain("Resposta B");
    expect(html).toContain("<strong>així</strong>");
  });

  it("omits the why paragraph when the distractor has none", () => {
    const plain = [
      { text: "Resposta A", ok: false },
      { text: "Resposta B", ok: true },
    ];
    const html = renderToStaticMarkup(createElement(QuestionFeedback, { options: plain, selected: 0, answer: "Resposta B" }));
    expect(html).toContain("question-feedback is-incorrect");
    expect(html.match(/<p/g)?.length ?? 0).toBe(1);
  });

  it("treats an unanswered question as incorrect", () => {
    const html = renderToStaticMarkup(createElement(QuestionFeedback, { options, selected: null, answer: "Resposta B" }));
    expect(html).toContain("question-feedback is-incorrect");
    expect(html).toContain("Resposta correcta:");
  });
});

describe("Reading feedback blocks", () => {
  const item: Item = {
    id: "a2-01-001", type: "reading", point: "p", lesson: 1, explanation: "x",
    title: "Títol", text: "Primer paràgraf.",
    questions: [
      { prompt: "Pregunta 1?", answer: "Resposta B", distractors: [{ text: "Resposta A", why: "Distractor 1." }, { text: "Resposta C" }] },
      { prompt: "Pregunta 2?", answer: "Resposta A", distractors: [{ text: "Resposta B" }, { text: "Resposta C" }] },
    ],
  };

  it("shows no per-question feedback before checking", () => {
    const html = renderToStaticMarkup(createElement(Reading, { item, done: false, onResult: noop }));
    expect(html).not.toContain("question-feedback");
    expect(html).toContain("Comprova");
  });

  it("shows one feedback block after each question once done", () => {
    const html = renderToStaticMarkup(createElement(Reading, { item, done: true, onResult: noop }));
    expect(html.match(/question-feedback is-incorrect/g)?.length ?? 0).toBe(2);
    expect(html).toContain("Resposta correcta: Resposta B");
    expect(html).toContain("Resposta correcta: Resposta A");
  });
});

describe("Exercise wrapper", () => {
  it("renders without touching the keyboard API on the server", () => {
    const item: Item = {
      id: "a2-01-002", type: "choice", point: "p", lesson: 1, explanation: "x",
      prompt: "___", answer: "a", distractors: [{ text: "b" }, { text: "c" }],
    };
    const html = renderToStaticMarkup(createElement(Exercise, { item, done: false, onResult: noop }));
    expect(html).toContain("Comprova");
    expect(html).toContain("option");
  });
});

describe("feedback css contract", () => {
  // The stream file was concatenated into styles.css by the integrator.
  const css = readFileSync("src/app/styles.css", "utf8");

  it("styles the submitted-vs-expected comparison", () => {
    for (const selector of [".answer-comparison", ".comparison-label", ".comparison-value", ".comparison-value.is-correct"]) {
      expect(css).toContain(selector);
    }
  });

  it("styles the per-question feedback blocks", () => {
    for (const selector of [".question-feedback", ".question-feedback.is-correct", ".question-feedback.is-incorrect", ".question-feedback p"]) {
      expect(css).toContain(selector);
    }
  });

  it("lifts the bottom bar above the keyboard", () => {
    expect(css).toContain(".bottom-bar");
    expect(css).toContain("--keyboard-offset");
  });
});

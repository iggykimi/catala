import { z } from "zod";

// Content contract shared by the validator and the app. Unknown keys are rejected
// (strictObject) so a misspelt field in LLM-authored YAML fails loudly instead of
// being silently ignored.

const text = z.string().trim().min(1);

export const LEVELS = ["A2", "B1", "B2"] as const;
export const Level = z.enum(LEVELS);

/** "strict": exact after normalisation. "tolerant": accent slips and typos in copied words pass with a warning. */
export const Grading = z.enum(["strict", "tolerant"]);

const Reference = z.strictObject({
  label: text,
  url: z.url({ protocol: /^https$/ }).optional(),
});

const Point = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case"),
  title: text,
  refs: z.array(Reference).default([]),
});

const VocabEntry = z.strictObject({
  word: text,
  definition: text,
  example: text,
});

const Lesson = z.strictObject({
  title: text,
});

/** A wrong option or a known wrong answer, with the feedback shown when the learner picks it. */
const Wrong = z.strictObject({
  text,
  why: text.optional(),
});

const base = {
  id: z.string().regex(/^(a2|b1|b2)-\d{2}-\d{3}$/, "unitid-NNN, e.g. a2-01-007"),
  point: text,
  lesson: z.number().int().min(1),
  /** Overrides the default instruction of the exercise type. */
  instruction: text.optional(),
  /** Why the answer is what it is; always shown after answering. */
  explanation: text,
};

export const ChoiceItem = z.strictObject({
  ...base,
  type: z.literal("choice"),
  /** A sentence with exactly one ___ gap, or a question. */
  prompt: text,
  answer: text,
  distractors: z.array(Wrong).min(2).max(3),
});

export const FillItem = z.strictObject({
  ...base,
  type: z.literal("fill"),
  /** A sentence with exactly one ___ gap. */
  prompt: text,
  /** What to do with the gap, e.g. "anar, passat perifràstic" or "TRANQUIL". */
  hint: text,
  /** Every accepted answer; the first is the one shown as correct. */
  answers: z.array(text).min(1),
  wrong_answers: z.array(Wrong).default([]),
  grading: Grading,
});

export const TransformItem = z.strictObject({
  ...base,
  type: z.literal("transform"),
  /** Original sentence; [[...]] marks the segments to transform. */
  source: text,
  /** Fixed beginning of the answer, shown before the input. Every answer must start with it. */
  start: text.optional(),
  /** Full accepted sentences (including `start`); the first is the one shown as correct. */
  answers: z.array(text).min(1),
  wrong_answers: z.array(Wrong).default([]),
  grading: Grading,
});

export const InlineChoiceItem = z.strictObject({
  ...base,
  type: z.literal("inline-choice"),
  title: text.optional(),
  /** Text with {correct|wrong|...} gaps; the first option is the correct one, ∅ means "nothing". */
  text,
});

/** Either a sentence with one wrong segment (error + fix + fix_distractors) or a correct one (no_error: true). */
export const FindErrorItem = z
  .strictObject({
    ...base,
    type: z.literal("find-error"),
    sentence: text,
    no_error: z.literal(true).optional(),
    /** The wrong segment; must occur exactly once in `sentence`. */
    error: text.optional(),
    fix: text.optional(),
    fix_distractors: z.array(Wrong).min(2).max(3).optional(),
  })
  .superRefine((it, ctx) => {
    const parts = [it.error, it.fix, it.fix_distractors].filter((p) => p !== undefined).length;
    if (it.no_error ? parts !== 0 : parts !== 3) {
      ctx.addIssue({ code: "custom", message: "use either no_error: true, or all of error, fix and fix_distractors" });
    }
  });

export const OrderItem = z.strictObject({
  ...base,
  type: z.literal("order"),
  /** Context that pins down the meaning, e.g. "Respon que encara no li has donat el regal." */
  cue: text,
  /** Chunks in the canonical order; the app shuffles them. */
  chunks: z.array(text).min(3).max(12),
  /** Extra chunks that do not belong in the answer. */
  extra: z.array(text).max(3).default([]),
  /** Every accepted full sentence; each one must use exactly `chunks`. */
  answers: z.array(text).min(1),
});

export const MatchItem = z.strictObject({
  ...base,
  type: z.literal("match"),
  pairs: z.array(z.tuple([text, text])).min(4).max(6),
});

const ReadingQuestion = z.strictObject({
  prompt: text,
  answer: text,
  distractors: z.array(Wrong).min(2).max(3),
});

export const ReadingItem = z.strictObject({
  ...base,
  type: z.literal("reading"),
  title: text,
  text,
  questions: z.array(ReadingQuestion).min(3).max(5),
});

// Discriminated on `type` so a schema error names the field of the right item type.
export const Item = z.discriminatedUnion("type", [
  ChoiceItem,
  FillItem,
  TransformItem,
  InlineChoiceItem,
  FindErrorItem,
  OrderItem,
  MatchItem,
  ReadingItem,
]);

export const Unit = z.strictObject({
  id: z.string().regex(/^(a2|b1|b2)-\d{2}$/, "e.g. a2-01"),
  level: Level,
  title: text,
  summary: text,
  vocabulary_theme: text,
  points: z.array(Point).min(1),
  lessons: z.array(Lesson).min(1),
  vocabulary: z.array(VocabEntry).default([]),
  items: z.array(Item).min(1),
});

export type Unit = z.infer<typeof Unit>;
export type Item = z.infer<typeof Item>;
export type Grading = z.infer<typeof Grading>;
export type Wrong = z.infer<typeof Wrong>;
export const ITEM_TYPES = [
  "choice",
  "fill",
  "transform",
  "inline-choice",
  "find-error",
  "order",
  "match",
  "reading",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

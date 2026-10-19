import type { Grading, Wrong } from "../content/schema";

export type Note = "accent" | "typo";

export type Verdict =
  | { verdict: "correct"; expected: string }
  | { verdict: "accepted"; expected: string; notes: Note[] }
  | { verdict: "wrong"; expected: string; why?: string };

export interface TypedSpec {
  answers: string[];
  wrong_answers?: Wrong[];
  grading: Grading;
  /** Source sentence of a transform item: answer words copied from it get typo tolerance. */
  source?: string;
}

const APOSTROPHES = /[’‘ʼ´`]/g;
const GEMINATE_L = /l[.•∙⋅]l|ŀl/g;
const QUOTES = /[«»“”„]/g;

/** Canonical form for comparison: case, spacing, apostrophe and l·l variants, and end punctuation don't count. */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(GEMINATE_L, "l·l")
    .replace(QUOTES, '"')
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/^[\s¿¡"]+|[\s.!?…"]+$/g, "")
    .replace(/\s+/g, " ");
}

/** Drops accents, dieresis, cedilla and the middle dot: what an accent slip changes. */
export function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").replace(/·/g, "");
}

/** Optimal string alignment distance (Levenshtein plus adjacent transposition). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

const tokens = (s: string) => s.split(" ").map((t) => t.replace(/[,;:]$/, ""));

const MIN_TYPO_LENGTH = 4;

/**
 * Tolerant comparison, token by token. Any token may differ only in diacritics.
 * A one-letter typo is forgiven only in words the learner copied from `source`:
 * the words they had to produce (the point of the exercise) must be right, since
 * a single letter there is often a different form (menjarem / menjareu).
 */
function tolerantMatch(input: string, answer: string, copied: Set<string>): Note[] | null {
  const a = tokens(answer);
  const b = tokens(input);
  if (a.length !== b.length) return null;
  const notes = new Set<Note>();
  for (let i = 0; i < a.length; i++) {
    const want = a[i]!;
    const got = b[i]!;
    if (want === got) continue;
    if (foldDiacritics(want) === foldDiacritics(got)) {
      notes.add("accent");
      continue;
    }
    if (copied.has(want) && want.length >= MIN_TYPO_LENGTH && editDistance(foldDiacritics(want), foldDiacritics(got)) <= 1) {
      notes.add("typo");
      continue;
    }
    return null;
  }
  return [...notes];
}

export function gradeTyped(rawInput: string, spec: TypedSpec): Verdict {
  const input = normalize(rawInput);
  const expected = spec.answers[0]!;
  const answers = spec.answers.map(normalize);
  const wrongs = (spec.wrong_answers ?? []).map((w) => ({ ...w, norm: normalize(w.text) }));

  const exact = answers.findIndex((a) => a === input);
  if (exact >= 0) return { verdict: "correct", expected: spec.answers[exact]! };

  const known = wrongs.find((w) => w.norm === input);
  if (known) return { verdict: "wrong", expected, why: known.why };

  if (spec.grading === "strict") return { verdict: "wrong", expected };

  // A slip that lands on a known wrong answer is that wrong answer, not a slip.
  const folded = foldDiacritics(input);
  const nearWrong = wrongs.find((w) => foldDiacritics(w.norm) === folded);
  if (nearWrong) return { verdict: "wrong", expected, why: nearWrong.why };

  const copied = new Set(spec.source ? tokens(normalize(spec.source.replace(/\[\[|\]\]/g, ""))) : []);
  for (let i = 0; i < answers.length; i++) {
    const notes = tolerantMatch(input, answers[i]!, copied);
    if (notes) return { verdict: "accepted", expected: spec.answers[i]!, notes };
  }
  return { verdict: "wrong", expected };
}

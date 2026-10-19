import { foldDiacritics, gradeTyped, normalize } from "../grading/grade";
import { gapCount, MarkupError, parseInline, parseMarks } from "./markup";
import type { Item, Unit, Wrong } from "./schema";

export interface Issue {
  severity: "error" | "warning";
  where: string;
  message: string;
}

// Words that only an accent tells apart (IEC 2017 diacritics plus què/que):
// with tolerant grading an accent slip on them would pass as correct.
const DIACRITIC_PAIRS = new Set([
  "que", "es", "mes", "se", "si", "te", "son", "be", "mon", "ma", "deu", "pel", "sol", "us", "vos",
]);

const MIN_ITEMS_PER_LESSON = 10;
const MIN_ITEMS_PER_POINT = 6;
const MIN_TYPES_PER_LESSON = 3;
const MAX_CHOICE_SHARE = 0.4;
const MIN_NO_ERROR_SHARE = 0.25;
const INLINE_GAPS = { min: 3, max: 8 };

export function checkUnit(unit: Unit): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ severity: "error", where, message });
  const warn = (where: string, message: string) => issues.push({ severity: "warning", where, message });

  if (!unit.id.startsWith(unit.level.toLowerCase())) err(unit.id, `id does not match level ${unit.level}`);

  const pointIds = new Set(unit.points.map((p) => p.id));
  if (pointIds.size !== unit.points.length) err(unit.id, "duplicate point ids");

  const seen = new Set<string>();
  for (const item of unit.items) {
    if (seen.has(item.id)) err(item.id, "duplicate item id");
    seen.add(item.id);
    if (!item.id.startsWith(`${unit.id}-`)) err(item.id, `id must start with ${unit.id}-`);
    if (!pointIds.has(item.point)) err(item.id, `unknown point "${item.point}"`);
    if (item.lesson > unit.lessons.length) err(item.id, `lesson ${item.lesson} does not exist`);
    try {
      checkItem(item, (m) => err(item.id, m), (m) => warn(item.id, m));
    } catch (e) {
      if (e instanceof MarkupError) err(item.id, e.message);
      else throw e;
    }
  }

  unit.lessons.forEach((_, i) => {
    const items = unit.items.filter((it) => it.lesson === i + 1);
    if (items.length === 0) err(`${unit.id} lesson ${i + 1}`, "lesson has no items");
    else if (items.length < MIN_ITEMS_PER_LESSON) warn(`${unit.id} lesson ${i + 1}`, `only ${items.length} items`);
    const types = new Set(items.map((it) => it.type));
    if (items.length > 0 && types.size < MIN_TYPES_PER_LESSON) warn(`${unit.id} lesson ${i + 1}`, `only ${types.size} exercise types`);
    if (items.filter((it) => it.type === "reading").length > 1) warn(`${unit.id} lesson ${i + 1}`, "more than one reading");
  });

  const findErrors = unit.items.filter((it) => it.type === "find-error");
  const correctOnes = findErrors.filter((it) => it.no_error).length;
  if (findErrors.length >= 4 && correctOnes / findErrors.length < MIN_NO_ERROR_SHARE) {
    warn(unit.id, `only ${correctOnes} of ${findErrors.length} find-error items have no_error: true`);
  }

  for (const id of pointIds) {
    const n = unit.items.filter((it) => it.point === id).length;
    if (n < MIN_ITEMS_PER_POINT) warn(`${unit.id} point ${id}`, `only ${n} items`);
  }

  const choices = unit.items.filter((it) => it.type === "choice").length;
  if (choices / unit.items.length > MAX_CHOICE_SHARE) {
    warn(unit.id, `${Math.round((100 * choices) / unit.items.length)}% of items are "choice"`);
  }
  return issues;
}

function checkOptions(answer: string, distractors: Wrong[], err: (m: string) => void, warn: (m: string) => void) {
  const all = [answer, ...distractors.map((d) => d.text)].map(normalize);
  if (new Set(all).size !== all.length) err("options repeat (or a distractor equals the answer)");
  const longest = Math.max(...distractors.map((d) => d.text.length));
  if (answer.length > 8 && answer.length > 1.5 * longest) warn("the answer is much longer than every distractor");
}

function checkTyped(
  item: { answers: string[]; wrong_answers: Wrong[]; grading: "strict" | "tolerant" },
  source: string | undefined,
  err: (m: string) => void,
  warn: (m: string) => void,
) {
  const answers = item.answers.map(normalize);
  if (new Set(answers).size !== answers.length) err("answers repeat");
  for (const w of item.wrong_answers) {
    if (answers.includes(normalize(w.text))) err(`wrong answer "${w.text}" is also an accepted answer`);
  }
  const spec = { ...item, source };
  for (const a of item.answers) {
    if (gradeTyped(a, spec).verdict !== "correct") err(`answer "${a}" does not grade as correct`);
  }
  for (const w of item.wrong_answers) {
    if (gradeTyped(w.text, spec).verdict !== "wrong") err(`wrong answer "${w.text}" does not grade as wrong`);
  }
  if (item.grading === "tolerant") {
    const folded = new Set(answers.map(foldDiacritics));
    for (const w of item.wrong_answers) {
      if (folded.has(foldDiacritics(normalize(w.text)))) {
        err(`"${w.text}" differs from an answer only in accents: grading must be strict`);
      }
    }
    const words = answers.flatMap((a) => a.split(/[\s'-]+/));
    const risky = words.filter((w) => DIACRITIC_PAIRS.has(foldDiacritics(w)));
    if (risky.length > 0) warn(`tolerant grading with accent-only pairs (${[...new Set(risky)].join(", ")}): is the accent the point?`);
  }
}

function checkItem(item: Item, err: (m: string) => void, warn: (m: string) => void) {
  switch (item.type) {
    case "choice":
      if (gapCount(item.prompt) > 1) err("prompt has more than one ___ gap");
      checkOptions(item.answer, item.distractors, err, warn);
      break;
    case "fill":
      if (gapCount(item.prompt) !== 1) err("prompt must have exactly one ___ gap");
      checkTyped(item, undefined, err, warn);
      break;
    case "transform": {
      const { plain } = parseMarks(item.source);
      if (item.start) {
        for (const a of item.answers) {
          if (!normalize(a).startsWith(normalize(item.start))) err(`answer "${a}" does not start with "${item.start}"`);
        }
      }
      if (item.answers.some((a) => normalize(a) === normalize(plain))) err("an answer is identical to the source");
      checkTyped(item, item.source, err, warn);
      break;
    }
    case "inline-choice": {
      const gaps = parseInline(item.text).filter((s) => typeof s !== "string");
      if (gaps.length === 0) err("text has no {…|…} gap");
      else if (gaps.length < INLINE_GAPS.min || gaps.length > INLINE_GAPS.max) {
        warn(`${gaps.length} gaps (aim for ${INLINE_GAPS.min}–${INLINE_GAPS.max})`);
      }
      break;
    }
    case "find-error": {
      const { error, fix, fix_distractors } = item;
      if (item.no_error || !error || !fix || !fix_distractors) break;
      if (item.sentence.split(error).length !== 2) err(`error "${error}" must occur exactly once in the sentence`);
      checkOptions(fix, fix_distractors, err, warn);
      if (fix_distractors.some((d) => normalize(d.text) === normalize(error))) {
        // Offering the original wrong segment as a "fix" is fine only if it is deliberate; flag it.
        warn("a fix distractor repeats the original error");
      }
      break;
    }
    case "order": {
      const canonical = normalize(item.chunks.join(" "));
      if (canonical !== normalize(item.answers[0]!)) err("the first answer must be the chunks in their given order");
      const bag = (s: string) => normalize(s).split(" ").sort().join(" ");
      const chunkBag = bag(item.chunks.join(" "));
      for (const a of item.answers) {
        if (bag(a) !== chunkBag) err(`answer "${a}" does not use exactly the chunks`);
      }
      for (const x of item.extra) {
        if (item.chunks.some((c) => normalize(c) === normalize(x))) err(`extra chunk "${x}" is also a real chunk`);
      }
      break;
    }
    case "match": {
      const lefts = item.pairs.map((p) => normalize(p[0]));
      const rights = item.pairs.map((p) => normalize(p[1]));
      if (new Set(lefts).size !== lefts.length || new Set(rights).size !== rights.length) err("pairs repeat a side");
      break;
    }
    case "reading":
      for (const q of item.questions) checkOptions(q.answer, q.distractors, err, warn);
      break;
  }
}

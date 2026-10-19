import { applyFix, GAP, parseMarks, renderCorrect } from "./markup";
import type { Item, Unit } from "./schema";

/** A piece of text from a unit that must be correct Catalan, with where it comes from. */
export interface Sentence {
  where: string;
  text: string;
  /** A phrase rather than a sentence (match sides): no capital or full stop expected. */
  fragment?: boolean;
}

const fillGap = (prompt: string, answer: string) => (prompt.includes(GAP) ? prompt.replace(GAP, answer) : `${prompt} ${answer}`);

function itemSentences(item: Item): string[] {
  const out: string[] = [item.explanation];
  const why = (ws: { why?: string }[]) => ws.flatMap((w) => (w.why ? [w.why] : []));
  switch (item.type) {
    case "choice":
      out.push(fillGap(item.prompt, item.answer), ...why(item.distractors));
      break;
    case "fill":
      out.push(...item.answers.map((a) => fillGap(item.prompt, a)), ...why(item.wrong_answers));
      break;
    case "transform":
      // The source is pushed separately by unitSentences: it may be wrong on purpose.
      out.push(...item.answers, ...why(item.wrong_answers));
      break;
    case "inline-choice":
      out.push(renderCorrect(item.text));
      if (item.title) out.push(item.title);
      break;
    case "find-error":
      if (item.no_error || !item.error || !item.fix) out.push(item.sentence);
      else out.push(applyFix(item.sentence, item.error, item.fix), ...why(item.fix_distractors ?? []));
      break;
    case "order":
      out.push(item.cue, ...item.answers);
      break;
    case "match":
      // Pairs are fragments; unitSentences marks them so.
      break;
    case "reading":
      // Reading distractors are false statements, but still correct Catalan.
      out.push(item.title, item.text);
      for (const q of item.questions) out.push(q.prompt, q.answer, ...q.distractors.map((d) => d.text), ...why(q.distractors));
      break;
  }
  if (item.instruction) out.push(item.instruction);
  return out;
}

/** Every text in the unit that should pass a Catalan grammar checker as it stands. */
export function unitSentences(unit: Unit): Sentence[] {
  const out: Sentence[] = [
    { where: unit.id, text: unit.title },
    { where: unit.id, text: unit.summary },
    ...unit.points.map((p) => ({ where: `${unit.id} point ${p.id}`, text: p.title })),
    ...unit.vocabulary.flatMap((v) => [
      { where: `${unit.id} vocab ${v.word}`, text: v.definition },
      { where: `${unit.id} vocab ${v.word}`, text: v.example },
    ]),
  ];
  for (const item of unit.items) {
    for (const text of itemSentences(item)) out.push({ where: item.id, text });
    if (item.type === "match") {
      for (const side of item.pairs.flat()) out.push({ where: item.id, text: side, fragment: true });
    }
    if (item.type === "transform") {
      // "Correct this" transforms start from a wrong sentence; findings here may be deliberate.
      out.push({ where: `${item.id} source`, text: parseMarks(item.source).plain });
    }
  }
  return out;
}

/**
 * Spans that cite language rather than use it, and must not be reported:
 * *forms* in italics (*tinc que* és un castellanisme), «quotes» of the sentence or
 * of Spanish, and ~~struck-out~~ errors.
 */
export function quotedSpans(text: string): [number, number][] {
  return [...text.matchAll(/«[^»]*»|~~[^~]*~~|\*[^*]+\*/g)].map((m) => [m.index, m.index + m[0].length]);
}

// Inline markup used in exercise text:
//   {correct|wrong|...}  a gap with options (inline-choice); ∅ stands for "nothing"
//   [[segment]]          a highlighted segment (transform sources)
//   ___                  the gap of choice and fill prompts

export const EMPTY_OPTION = "∅";
export const GAP = "___";

export type InlineSegment = string | { options: string[] };

export class MarkupError extends Error {}

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = /\{([^{}]*)\}/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    segments.push(text.slice(last, m.index));
    const options = m[1]!.split("|").map((o) => (o.trim() === EMPTY_OPTION ? "" : o));
    if (options.length < 2) throw new MarkupError(`gap "{${m[1]}}" needs at least two options`);
    if (new Set(options).size !== options.length) throw new MarkupError(`gap "{${m[1]}}" repeats an option`);
    segments.push({ options });
    last = m.index + m[0].length;
  }
  const tail = text.slice(last);
  if (/[{}]/.test(tail) || segments.some((s) => typeof s === "string" && /[{}]/.test(s))) {
    throw new MarkupError("unbalanced or nested braces");
  }
  segments.push(tail);
  return segments.filter((s) => s !== "");
}

/** The text with every gap filled with its correct (first) option. */
export function renderCorrect(text: string): string {
  return parseInline(text)
    .map((s) => (typeof s === "string" ? s : s.options[0]))
    .join("");
}

export function gapCount(prompt: string): number {
  return prompt.split(GAP).length - 1;
}

/** The text without [[ ]] marks, and the marked segments. */
export function parseMarks(source: string): { plain: string; marked: string[] } {
  if ((source.match(/\[\[/g) ?? []).length !== (source.match(/\]\]/g) ?? []).length) {
    throw new MarkupError("unbalanced [[ ]]");
  }
  const marked = [...source.matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1]!);
  return { plain: source.replace(/\[\[|\]\]/g, ""), marked };
}

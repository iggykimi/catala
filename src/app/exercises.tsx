import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyFix, GAP, parseInline } from "../content/markup";
import type { Item, Wrong } from "../content/schema";
import { gradeTyped, normalizeOrder, type Note } from "../grading/grade";
import type { Verdict } from "./session";
import { Rich, shuffle } from "./ui";

export interface Result {
  verdict: Verdict;
  /** The right answer, shown when the learner's differs. */
  expected?: string;
  /** What the learner typed, shown next to the expected answer. */
  submitted?: string;
  why?: string;
  notes?: Note[];
}

type Of<T extends Item["type"]> = Extract<Item, { type: T }>;
interface Props<T extends Item["type"]> {
  item: Of<T>;
  done: boolean;
  onResult: (r: Result) => void;
}

function CheckBar({ ready, onCheck, done }: { ready: boolean; onCheck: () => void; done: boolean }) {
  if (done) return null;
  return (
    <div className="bottom-bar">
      <button className="btn btn-primary" disabled={!ready} onClick={onCheck}>
        Comprova
      </button>
    </div>
  );
}

/** Guards the single onResult call: rapid double taps must not evaluate twice. */
function useFire(onResult: (r: Result) => void) {
  const fired = useRef(false);
  return (r: Result) => {
    if (fired.current) return;
    fired.current = true;
    onResult(r);
  };
}

function Instruction({ text }: { text?: string }) {
  return text ? (
    <p className="instruction">
      <Rich text={text} />
    </p>
  ) : null;
}

/** A sentence with its ___ gap replaced by `fill`. */
function GapText({ text, fill, state }: { text: string; fill?: ReactNode; state?: "ok" | "bad" }) {
  const [before, after] = text.split(GAP);
  if (after === undefined) return <Rich text={text} />;
  return (
    <>
      <Rich text={before ?? ""} />
      <span className={`gap${state ? ` is-${state}` : ""}`}>{fill ?? " "}</span>
      <Rich text={after} />
    </>
  );
}

interface Option {
  text: string;
  ok: boolean;
  why?: string;
}
const optionsOf = (answer: string, distractors: Wrong[]): Option[] =>
  shuffle([{ text: answer, ok: true }, ...distractors.map((d) => ({ text: d.text, ok: false, why: d.why }))]);

function Options({ options, selected, done, onSelect }: { options: Option[]; selected: number | null; done: boolean; onSelect: (i: number) => void }) {
  return (
    <div className="options">
      {options.map((o, i) => {
        const cls = ["option"];
        if (selected === i) cls.push("is-selected");
        if (done && o.ok) cls.push("is-right");
        if (done && selected === i && !o.ok) cls.push("is-wrong");
        return (
          <button key={i} className={cls.join(" ")} disabled={done} aria-pressed={selected === i} onClick={() => onSelect(i)}>
            <Rich text={o.text} />
          </button>
        );
      })}
    </div>
  );
}

export function Choice({ item, done, onResult }: Props<"choice">) {
  const options = useMemo(() => optionsOf(item.answer, item.distractors), [item]);
  const [sel, setSel] = useState<number | null>(null);
  const fire = useFire(onResult);
  const select = (i: number) => {
    setSel(i);
    const o = options[i]!;
    fire(o.ok ? { verdict: "correct" } : { verdict: "wrong", why: o.why });
  };
  const chosen = sel === null ? null : options[sel]!;
  return (
    <div className="ex enter">
      <Instruction text={item.instruction} />
      <p className="prompt">
        <GapText text={item.prompt} fill={chosen && <Rich text={chosen.text} />} state={done ? (chosen?.ok ? "ok" : "bad") : undefined} />
      </p>
      <Options options={options} selected={sel} done={done} onSelect={select} />
    </div>
  );
}

export function typedResult(value: string, spec: Parameters<typeof gradeTyped>[1]): Result {
  const v = gradeTyped(value, spec);
  if (v.verdict === "correct") return { verdict: "correct" };
  if (v.verdict === "accepted") return { verdict: "accepted", submitted: value, expected: v.expected, notes: v.notes };
  return { verdict: "wrong", submitted: value, expected: v.expected, why: v.why };
}

const onEnter = (ready: boolean, check: () => void) => (e: React.KeyboardEvent) => {
  // isComposing: an Enter that confirms an IME composition must not check the answer.
  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && ready) {
    e.preventDefault();
    check();
  }
};

export function Fill({ item, done, onResult }: Props<"fill">) {
  const [value, setValue] = useState("");
  const ready = value.trim() !== "";
  const check = () => onResult(typedResult(value, item));
  const width = Math.max(...item.answers.map((a) => a.length), 4) + 2;
  return (
    <div className="ex enter">
      <Instruction text={item.instruction} />
      <p className="prompt">
        <GapText
          text={item.prompt}
          fill={
            <input
              className="gap-input"
              style={{ width: `${width}ch` }}
              value={value}
              disabled={done}
              autoFocus
              enterKeyHint="go"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Resposta"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onEnter(ready, check)}
            />
          }
        />
      </p>
      <p className="hint">
        <Rich text={item.hint} />
      </p>
      <CheckBar ready={ready} onCheck={check} done={done} />
    </div>
  );
}

export function Transform({ item, done, onResult }: Props<"transform">) {
  const [value, setValue] = useState("");
  const full = item.start ? `${item.start} ${value}` : value;
  const ready = value.trim() !== "";
  const check = () => onResult(typedResult(full, item));
  return (
    <div className="ex enter">
      <Instruction text={item.instruction ?? "Reescriu la frase."} />
      <p className="prompt source">
        <Rich text={item.source} />
      </p>
      <label className="answer-field">
        {item.start && <span className="start">{item.start}</span>}
        <textarea
          rows={2}
          value={value}
          disabled={done}
          autoFocus
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Resposta"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onEnter(ready, check)}
        />
      </label>
      <CheckBar ready={ready} onCheck={check} done={done} />
    </div>
  );
}

export function InlineChoice({ item, done, onResult }: Props<"inline-choice">) {
  const segments = useMemo(() => parseInline(item.text), [item]);
  const gaps = useMemo(
    () => segments.flatMap((s) => (typeof s === "string" ? [] : [{ correct: s.options[0]!, options: shuffle(s.options) }])),
    [segments],
  );
  const [chosen, setChosen] = useState<(string | null)[]>(() => gaps.map(() => null));
  const [active, setActive] = useState(0);
  const fire = useFire(onResult);
  const choose = (opt: string) => {
    const next = chosen.map((c, i) => (i === active ? opt : c));
    setChosen(next);
    const empty = next.findIndex((c, i) => c === null && i > active);
    const anyEmpty = next.findIndex((c) => c === null);
    setActive(empty >= 0 ? empty : anyEmpty >= 0 ? anyEmpty : active);
    if (next.every((c) => c !== null)) {
      const ok = gaps.every((g, i) => next[i] === g.correct);
      fire({ verdict: ok ? "correct" : "wrong" });
    }
  };
  const label = (o: string) => (o === "" ? "—" : o);
  let g = -1;
  return (
    <div className="ex enter">
      <Instruction text={item.instruction} />
      {item.title && <h2 className="ex-title">{item.title}</h2>}
      <p className="prompt reading-text">
        {segments.map((s, i) => {
          if (typeof s === "string") return <span key={i}>{s}</span>;
          const gi = ++g;
          const right = chosen[gi] === gaps[gi]!.correct;
          const state = done ? (right ? " is-ok" : " is-bad") : "";
          return (
            <button key={i} className={`slot${gi === active && !done ? " is-active" : ""}${state}`} disabled={done} onClick={() => setActive(gi)} aria-label={`Buit ${gi + 1}`}>
              {done && !right ? (
                <>
                  <del>{label(chosen[gi]!)}</del> <ins>{label(gaps[gi]!.correct)}</ins>
                </>
              ) : chosen[gi] === null ? (
                " "
              ) : (
                label(chosen[gi]!)
              )}
            </button>
          );
        })}
      </p>
      {!done && (
        <div className="chips">
          {gaps[active]!.options.map((o) => (
            <button key={o} className={`chip${chosen[active] === o ? " is-selected" : ""}`} aria-label={o === "" ? "res" : o} onClick={() => choose(o)}>
              {label(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FindError({ item, done, onResult }: Props<"find-error">) {
  const tokens = useMemo(() => [...item.sentence.matchAll(/\S+/g)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length })), [item]);
  const errStart = item.error ? item.sentence.indexOf(item.error) : -1;
  const errEnd = errStart + (item.error?.length ?? 0);
  const inError = (i: number) => errStart >= 0 && tokens[i]!.start < errEnd && tokens[i]!.end > errStart;
  const fixed = item.error && item.fix ? applyFix(item.sentence, item.error, item.fix) : item.sentence;
  const fixOptions = useMemo(() => (item.fix && item.fix_distractors ? optionsOf(item.fix, item.fix_distractors) : []), [item]);
  const [stage, setStage] = useState<"pick" | "fix">("pick");
  const [pick, setPick] = useState<number | "none" | null>(null);
  const [fixSel, setFixSel] = useState<number | null>(null);
  const fire = useFire(onResult);

  // Every tap resolves immediately: a right pick moves to the fix stage, anything else is the verdict.
  const pickToken = (i: number) => {
    setPick(i);
    if (item.no_error || !inError(i)) return fire({ verdict: "wrong", expected: item.no_error ? "No hi ha cap error." : fixed });
    setStage("fix");
  };
  const pickNone = () => {
    setPick("none");
    if (item.no_error) return fire({ verdict: "correct" });
    return fire({ verdict: "wrong", expected: fixed });
  };
  const pickFix = (i: number) => {
    setFixSel(i);
    const o = fixOptions[i]!;
    fire(o.ok ? { verdict: "correct" } : { verdict: "wrong", why: o.why });
  };
  return (
    <div className="ex enter">
      <Instruction text={item.instruction ?? (stage === "pick" ? "Toca la part incorrecta." : "Tria la correcció.")} />
      <p className="prompt tokens">
        {tokens.map((t, i) => {
          const cls = ["token"];
          if (stage === "fix" && inError(i)) cls.push("is-error");
          else if (pick === i) cls.push(done ? (inError(i) ? "is-error" : "is-wrong") : "is-selected");
          return (
            <button key={i} className={cls.join(" ")} disabled={done || stage === "fix"} aria-pressed={pick === i} onClick={() => pickToken(i)}>
              {t.text}
            </button>
          );
        })}
      </p>
      {stage === "pick" ? (
        <div className="options">
          <button className={`option${pick === "none" ? " is-selected" : ""}`} disabled={done} aria-pressed={pick === "none"} onClick={pickNone}>
            No hi ha cap error
          </button>
        </div>
      ) : (
        <Options options={fixOptions} selected={fixSel} done={done} onSelect={pickFix} />
      )}
    </div>
  );
}

export function Order({ item, done, onResult }: Props<"order">) {
  const bank = useMemo(() => shuffle([...item.chunks, ...item.extra]), [item]);
  const [placed, setPlaced] = useState<number[]>([]);
  const fire = useFire(onResult);
  // Checks once the placed chips cover every required text (extras may stay in the bank):
  // building and fixing never evaluates early, and stray chips ride along into the verdict.
  const covers = (placedIdx: number[]) => {
    const have = new Map<string, number>();
    for (const j of placedIdx) have.set(bank[j]!, (have.get(bank[j]!) ?? 0) + 1);
    return item.chunks.every((c) => {
      const n = have.get(c) ?? 0;
      if (n === 0) return false;
      have.set(c, n - 1);
      return true;
    });
  };
  const place = (i: number) => {
    const next = [...placed, i];
    setPlaced(next);
    if (covers(next)) {
      const text = next.map((j) => bank[j]).join(" ");
      const ok = item.answers.some((a) => normalizeOrder(a) === normalizeOrder(text));
      fire(ok ? { verdict: "correct" } : { verdict: "wrong", expected: item.answers[0] });
    }
  };
  return (
    <div className="ex enter">
      <Instruction text={item.instruction} />
      <p className="prompt cue">
        <Rich text={item.cue} />
      </p>
      <div className={`line${done ? " is-done" : ""}`} aria-label="Frase">
        {placed.map((i) => (
          <button key={i} className="chip" disabled={done} onClick={() => setPlaced(placed.filter((p) => p !== i))}>
            {bank[i]}
          </button>
        ))}
      </div>
      <div className="chips bank">
        {bank.map((c, i) => (
          <button key={i} className={`chip${placed.includes(i) ? " is-used" : ""}`} disabled={done || placed.includes(i)} onClick={() => place(i)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Final verdict once every pair is matched: flawless runs pass, runs with wrong attempts explain why they fail. */
export function matchCompletion(errors: number): Result {
  if (errors === 0) return { verdict: "correct" };
  return {
    verdict: "wrong",
    why: `Has completat totes les parelles, però has fet ${errors} ${errors === 1 ? "intent incorrecte." : "intents incorrectes."}`,
  };
}

export function Match({ item, done, onResult }: Props<"match">) {
  const left = useMemo(() => shuffle(item.pairs.map((p, i) => ({ t: p[0], i }))), [item]);
  const right = useMemo(() => shuffle(item.pairs.map((p, i) => ({ t: p[1], i }))), [item]);
  const [sel, setSel] = useState<{ side: "l" | "r"; i: number } | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [miss, setMiss] = useState<{ l: number; r: number } | null>(null);
  const mistakes = useRef(0);

  const tap = (side: "l" | "r", pairIndex: number) => {
    if (!sel || sel.side === side) return setSel({ side, i: pairIndex });
    const [l, r] = side === "r" ? [sel.i, pairIndex] : [pairIndex, sel.i];
    setSel(null);
    if (l === r) {
      const next = new Set(matched).add(l);
      setMatched(next);
      if (next.size === item.pairs.length) onResult(matchCompletion(mistakes.current));
    } else {
      mistakes.current++;
      setMiss({ l, r });
      setTimeout(() => setMiss(null), 450);
    }
  };
  const cell = (side: "l" | "r", e: { t: string; i: number }) => {
    const cls = ["option", "match-cell"];
    if (matched.has(e.i)) cls.push("is-right");
    else if (sel?.side === side && sel.i === e.i) cls.push("is-selected");
    else if (miss && (side === "l" ? miss.l : miss.r) === e.i) cls.push("is-wrong", "shake");
    return (
      <button key={e.i} className={cls.join(" ")} disabled={done || matched.has(e.i)} onClick={() => tap(side, e.i)}>
        <Rich text={e.t} />
      </button>
    );
  };
  return (
    <div className="ex enter">
      <Instruction text={item.instruction ?? "Relaciona."} />
      <div className="match">
        <div className="match-col">{left.map((e) => cell("l", e))}</div>
        <div className="match-col">{right.map((e) => cell("r", e))}</div>
      </div>
    </div>
  );
}

/** Textual verdict for one reading question, shown under its options after checking. */
export function QuestionFeedback({ options, selected, answer }: { options: Option[]; selected: number | null; answer: string }) {
  const selectedOption = selected === null ? null : options[selected];
  const correct = selectedOption?.ok === true;
  return (
    <div className={`question-feedback ${correct ? "is-correct" : "is-incorrect"}`}>
      <strong>{correct ? "Correcte" : "Resposta incorrecta"}</strong>
      {!correct && (
        <p className="correct-answer">
          Resposta correcta: <Rich text={answer} />
        </p>
      )}
      {!correct && selectedOption?.why && (
        <p>
          <Rich text={selectedOption.why} />
        </p>
      )}
    </div>
  );
}

export function Reading({ item, done, onResult }: Props<"reading">) {
  const options = useMemo(() => item.questions.map((q) => optionsOf(q.answer, q.distractors)), [item]);
  const [sel, setSel] = useState<(number | null)[]>(() => item.questions.map(() => null));
  const fire = useFire(onResult);
  const answerQuestion = (qi: number, i: number) => {
    const next = sel.map((s, j) => (j === qi ? i : s));
    setSel(next);
    if (next.every((s) => s !== null)) {
      const wrong = options.map((o, j) => o[next[j]!]!).find((o) => !o.ok);
      fire(wrong ? { verdict: "wrong", why: wrong.why } : { verdict: "correct" });
    }
  };
  return (
    <div className="ex enter">
      <Instruction text={item.instruction} />
      <article className="reading">
        <h2 className="ex-title">{item.title}</h2>
        {item.text
          .trim()
          .split(/\n\s*\n/)
          .map((p, i) => (
            <p key={i}>
              <Rich text={p} />
            </p>
          ))}
      </article>
      {item.questions.map((q, qi) => (
        <section key={qi} className="question">
          <p className="question-prompt">
            <Rich text={q.prompt} />
          </p>
          <Options options={options[qi]!} selected={sel[qi]!} done={done} onSelect={(i) => answerQuestion(qi, i)} />
          {done && <QuestionFeedback options={options[qi]!} selected={sel[qi]!} answer={q.answer} />}
        </section>
      ))}
    </div>
  );
}

export function Exercise(props: { item: Item; done: boolean; onResult: (r: Result) => void }) {
  const { item } = props;
  // Scroll each new exercise to the top (long readings leave the page scrolled down).
  useEffect(() => {
    // Braces matter: newer browsers return a promise from scrollTo, which React would take for a cleanup.
    window.scrollTo(0, 0);
  }, [item]);
  // Lift fixed bars above the on-screen keyboard where visualViewport reports the covered area.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard-offset", `${covered}px`);
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    sync();
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--keyboard-offset");
    };
  }, []);
  switch (item.type) {
    case "choice":
      return <Choice {...props} item={item} />;
    case "fill":
      return <Fill {...props} item={item} />;
    case "transform":
      return <Transform {...props} item={item} />;
    case "inline-choice":
      return <InlineChoice {...props} item={item} />;
    case "find-error":
      return <FindError {...props} item={item} />;
    case "order":
      return <Order {...props} item={item} />;
    case "match":
      return <Match {...props} item={item} />;
    case "reading":
      return <Reading {...props} item={item} />;
  }
}

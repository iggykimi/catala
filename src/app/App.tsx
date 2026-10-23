import { useEffect, useMemo, useRef, useState } from "react";
import units from "virtual:content";
import type { Item } from "../content/schema";
import { Exercise, type Result } from "./exercises";
import { emptyProgress, lessonKey, loadProgress, parseProgress, saveProgress, streak, type Progress } from "./progress";
import {
  answer,
  applySession,
  duePoints,
  lessonsDone,
  lessonSession,
  nextLesson,
  reviewSession,
  sessionProgress,
  unitOfItem,
  type AppUnit,
  type Session,
} from "./session";
import { Icon, Panot, Rich } from "./ui";

type Screen =
  | { k: "home" }
  | { k: "unit"; id: string }
  | { k: "theory"; id: string }
  | { k: "vocab"; id: string }
  | { k: "settings" }
  | { k: "session"; session: Session }
  | { k: "summary"; session: Session; before: Progress };

const LEVELS = ["A2", "B1", "B2"] as const;
const unitById = (id: string) => units.find((u) => u.id === id)!;

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [stack, setStack] = useState<Screen[]>([{ k: "home" }]);
  const items = useMemo(() => new Map<string, Item>(units.flatMap((u) => u.items.map((it) => [it.id, it]))), []);

  // The browser history mirrors the screen stack, so the Android back button goes back a screen.
  useEffect(() => {
    history.replaceState({ d: 0 }, "");
    const onPop = (e: PopStateEvent) => {
      const d = (e.state as { d?: number } | null)?.d ?? 0;
      setStack((s) => s.slice(0, d + 1));
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const push = (screen: Screen) => {
    history.pushState({ d: stack.length }, "");
    setStack([...stack, screen]);
  };
  const replace = (screen: Screen) => setStack((s) => [...s.slice(0, -1), screen]);
  const back = () => history.back();
  const home = () => history.go(-(stack.length - 1));

  const update = (p: Progress) => {
    saveProgress(p);
    setProgress(p);
  };
  const finish = (session: Session) => {
    const before = progress;
    update(applySession(progress, session, items, new Date()));
    replace({ k: "summary", session, before });
  };

  const screen = stack.at(-1)!;
  switch (screen.k) {
    case "home":
      return <Home progress={progress} push={push} />;
    case "unit":
      return <UnitScreen unit={unitById(screen.id)} progress={progress} push={push} back={back} />;
    case "theory":
      return <TheoryScreen unit={unitById(screen.id)} back={back} />;
    case "vocab":
      return <VocabScreen unit={unitById(screen.id)} back={back} />;
    case "settings":
      return <Settings progress={progress} update={update} back={back} />;
    case "session":
      return (
        <SessionScreen
          key={screen.session.unitId ?? "review"}
          initial={screen.session}
          flagged={progress.flagged}
          onFlag={(id) => update({ ...progress, flagged: progress.flagged.includes(id) ? progress.flagged.filter((f) => f !== id) : [...progress.flagged, id] })}
          onExit={back}
          onFinish={finish}
        />
      );
    case "summary":
      return <Summary session={screen.session} before={screen.before} after={progress} onDone={home} />;
  }
}

function TopBar({ onBack, title, children }: { onBack?: () => void; title?: string; children?: React.ReactNode }) {
  return (
    <header className="topbar">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Enrere">
          <Icon name="back" />
        </button>
      )}
      {title && <span className="topbar-title">{title}</span>}
      <span className="spacer" />
      {children}
    </header>
  );
}

function Home({ progress, push }: { progress: Progress; push: (s: Screen) => void }) {
  const now = new Date();
  const next = nextLesson(units, progress);
  const review = reviewSession(units, progress, now);
  const due = duePoints(progress, now).length;
  const days = streak(progress.days, now);
  // With many units the current one is often off screen: bring it into view on arrival.
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="screen home">
      <TopBar>
        {days > 0 && (
          <span className="streak" aria-label={`${days} dies seguits`}>
            <Panot filled={5} size={22} />
            {days}
          </span>
        )}
        <button className="icon-btn" onClick={() => push({ k: "settings" })} aria-label="Ajustos">
          <Icon name="menu" />
        </button>
      </TopBar>
      <main className="units">
        {LEVELS.map((level) => {
          const list = units.filter((u) => u.level === level);
          if (list.length === 0) return null;
          return (
            <section key={level} className="level">
              <h2 className="level-name">{level}</h2>
              {list.map((u) => {
                const n = lessonsDone(u, progress);
                return (
                  <button key={u.id} ref={next?.unit.id === u.id ? current : undefined} className="unit-row" onClick={() => push({ k: "unit", id: u.id })}>
                    <Panot filled={n} total={u.lessons.length} />
                    <span className="unit-title">
                      <Rich text={u.title} />
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </main>
      <div className="bottom-bar">
        {review.size > 0 && (
          <button className="secondary" onClick={() => push({ k: "session", session: review })}>
            Repàs <span className="count">{due}</span>
          </button>
        )}
        {next && (
          <button className="primary continue" onClick={() => push({ k: "session", session: lessonSession(next.unit, next.lesson) })}>
            <span className="continue-unit">
              <Rich text={next.unit.title} />
            </span>
            Continua
          </button>
        )}
      </div>
    </div>
  );
}

function UnitScreen({ unit, progress, push, back }: { unit: AppUnit; progress: Progress; push: (s: Screen) => void; back: () => void }) {
  return (
    <div className="screen unit">
      <TopBar onBack={back} />
      <main>
        <div className="unit-hero">
          <Panot filled={lessonsDone(unit, progress)} total={unit.lessons.length} size={88} />
          <h1>
            <Rich text={unit.title} />
          </h1>
          <p className="muted">
            <Rich text={unit.summary} />
          </p>
        </div>
        <div className="unit-links">
          <button className="secondary" onClick={() => push({ k: "theory", id: unit.id })}>
            Teoria
          </button>
          {unit.vocabulary.length > 0 && (
            <button className="secondary" onClick={() => push({ k: "vocab", id: unit.id })}>
              Vocabulari
            </button>
          )}
        </div>
        <ol className="lessons">
          {unit.lessons.map((l, i) => {
            const isDone = Boolean(progress.lessons[lessonKey(unit.id, i + 1)]);
            return (
              <li key={i}>
                <button className={`lesson-row${isDone ? " is-done" : ""}`} onClick={() => push({ k: "session", session: lessonSession(unit, i + 1) })}>
                  <span className="lesson-n" aria-label={isDone ? "Feta" : undefined}>
                    {i + 1}
                  </span>
                  <Rich text={l.title} />
                </button>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}

function TheoryScreen({ unit, back }: { unit: AppUnit; back: () => void }) {
  return (
    <div className="screen">
      <TopBar onBack={back} title="Teoria" />
      <main className="prose">
        {unit.points.map((p) => (
          <section key={p.id}>
            <div dangerouslySetInnerHTML={{ __html: unit.theory[p.id] ?? "" }} />
            {p.refs.map((r) => (
              <a key={r.label} className="ref" href={r.url} target="_blank" rel="noreferrer">
                <Rich text={r.label} />
              </a>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}

function VocabScreen({ unit, back }: { unit: AppUnit; back: () => void }) {
  return (
    <div className="screen">
      <TopBar onBack={back} title="Vocabulari" />
      <main>
        <dl className="vocab">
          {unit.vocabulary.map((v) => (
            <div key={v.word} className="vocab-entry">
              <dt>{v.word}</dt>
              <dd>
                <Rich text={v.definition} />
              </dd>
              <dd className="example">
                <Rich text={v.example} />
              </dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}

function SessionScreen({
  initial,
  flagged,
  onFlag,
  onExit,
  onFinish,
}: {
  initial: Session;
  flagged: string[];
  onFlag: (id: string) => void;
  onExit: () => void;
  onFinish: (s: Session) => void;
}) {
  const [session, setSession] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [turn, setTurn] = useState(0);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const item = session.queue[0];
  if (!item) return null;

  const next = () => {
    const after = answer(session, result!.verdict);
    if (after.queue.length === 0) return onFinish(after);
    setSession(after);
    setResult(null);
    setTheoryOpen(false);
    setTurn((t) => t + 1);
  };
  const exit = () => {
    if (Object.keys(session.firstTry).length === 0 || confirm("Vols sortir? Perdràs aquesta lliçó.")) onExit();
  };
  const unit = unitById(unitOfItem(item.id));
  const point = unit.points.find((p) => p.id === item.point);
  return (
    <div className="screen session">
      <header className="topbar">
        <button className="icon-btn" onClick={exit} aria-label="Surt">
          <Icon name="close" />
        </button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sessionProgress(session) * 100)}>
          <div className="progress-fill" style={{ width: `${sessionProgress(session) * 100}%` }} />
        </div>
      </header>
      <main className={result?.verdict === "wrong" ? "shake" : undefined}>
        <Exercise key={`${item.id}:${turn}`} item={item} done={result !== null} onResult={setResult} />
      </main>
      {result && (
        <Feedback
          result={result}
          explanation={item.explanation}
          flagged={flagged.includes(item.id)}
          onFlag={() => onFlag(item.id)}
          onTheory={() => setTheoryOpen(true)}
          onNext={next}
        />
      )}
      {theoryOpen && point && (
        <div className="overlay" role="dialog" aria-label="Teoria">
          <div className="overlay-panel prose">
            <button className="icon-btn overlay-close" onClick={() => setTheoryOpen(false)} aria-label="Tanca">
              <Icon name="close" />
            </button>
            <div dangerouslySetInnerHTML={{ __html: unit.theory[point.id] ?? "" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Feedback({
  result,
  explanation,
  flagged,
  onFlag,
  onTheory,
  onNext,
}: {
  result: Result;
  explanation: string;
  flagged: boolean;
  onFlag: () => void;
  onTheory: () => void;
  onNext: () => void;
}) {
  const ok = result.verdict !== "wrong";
  const note = result.notes?.includes("accent") ? "Compte amb l'accent:" : result.notes?.includes("typo") ? "S'escriu així:" : null;
  return (
    <section className={`sheet ${ok ? "is-ok" : "is-bad"}`} role="status">
      <div className="sheet-head">
        <strong className="sheet-title">{ok ? "Correcte" : "Incorrecte"}</strong>
        <button className={`icon-btn flag${flagged ? " is-on" : ""}`} onClick={onFlag} aria-pressed={flagged} aria-label="Marca aquest exercici per revisar-lo">
          <Icon name="flag" />
        </button>
      </div>
      {result.expected && (note || !ok) && (
        <p className="solution">
          {note && <span className="note">{note} </span>}
          <Rich text={result.expected} />
        </p>
      )}
      {result.why && (
        <p className="why">
          <Rich text={result.why} />
        </p>
      )}
      <p className="explanation">
        <Rich text={explanation} />
      </p>
      <div className="sheet-actions">
        <button className="ghost" onClick={onTheory}>
          Teoria
        </button>
        <button className="primary" autoFocus onClick={onNext}>
          Continua
        </button>
      </div>
    </section>
  );
}

function Summary({ session, before, after, onDone }: { session: Session; before: Progress; after: Progress; onDone: () => void }) {
  const right = Object.values(session.firstTry).filter((v) => v !== "wrong").length;
  const unit = session.unitId ? unitById(session.unitId) : null;
  const was = unit ? lessonsDone(unit, before) : 0;
  const now = unit ? lessonsDone(unit, after) : 0;
  return (
    <div className="screen summary">
      <main>
        {unit ? (
          <Panot filled={now} total={unit.lessons.length} fresh={now > was ? now - 1 : undefined} size={168} />
        ) : (
          <Panot filled={5} size={168} fresh={4} />
        )}
        <h1>{unit ? <Rich text={unit.title} /> : "Repàs fet"}</h1>
        <p className="score">
          <strong>{right}</strong> de {session.size} a la primera
        </p>
      </main>
      <div className="bottom-bar">
        <button className="primary" autoFocus onClick={onDone}>
          Continua
        </button>
      </div>
    </div>
  );
}

function Settings({ progress, update, back }: { progress: Progress; update: (p: Progress) => void; back: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = async (what: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
  };
  const restore = () => {
    const p = parseProgress(pasted);
    if (!p) return setError("Aquest text no és una còpia del progrés.");
    update(p);
    setPasted("");
    setError(null);
    setCopied("restored");
  };
  return (
    <div className="screen settings">
      <TopBar onBack={back} title="Ajustos" />
      <main>
        <section>
          <h2>Còpia del progrés</h2>
          <button className="secondary" onClick={() => copy("progress", JSON.stringify(progress))}>
            {copied === "progress" ? "Copiat" : "Copia el progrés"}
          </button>
          <textarea rows={3} value={pasted} placeholder="Enganxa aquí una còpia" aria-label="Còpia del progrés" onChange={(e) => setPasted(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="secondary" disabled={pasted.trim() === ""} onClick={restore}>
            {copied === "restored" ? "Restaurat" : "Restaura"}
          </button>
        </section>
        {progress.flagged.length > 0 && (
          <section>
            <h2>Exercicis marcats ({progress.flagged.length})</h2>
            <button className="secondary" onClick={() => copy("flagged", progress.flagged.join("\n"))}>
              {copied === "flagged" ? "Copiat" : "Copia la llista"}
            </button>
            <button className="ghost" onClick={() => update({ ...progress, flagged: [] })}>
              Buida la llista
            </button>
          </section>
        )}
        <section>
          <button className="ghost danger" onClick={() => confirm("S'esborrarà tot el progrés.") && update(emptyProgress())}>
            Esborra el progrés
          </button>
        </section>
      </main>
    </div>
  );
}

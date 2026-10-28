import { useEffect, useMemo, useRef, useState } from "react";
import units from "virtual:content";
import type { Item } from "../content/schema";
import dracAnim from "./assets/drac.webp";
import dracStill from "./assets/drac.png";
import focAnim from "./assets/foc.webp";
import focStill from "./assets/foc.png";
import { Exercise, type Result } from "./exercises";
import { celebrate, cue, loadPrefs, savePrefs, stopCelebration, type Prefs } from "./fx";
import { emptyProgress, lessonKey, loadProgress, localDate, parseProgress, saveProgress, streak, type Progress } from "./progress";
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
import { Icon, Panot, Rich, Sprite } from "./ui";

type Screen =
  | { k: "home" }
  | { k: "unit"; id: string }
  | { k: "theory"; id: string }
  | { k: "vocab"; id: string }
  | { k: "settings" }
  | { k: "intro"; id: string }
  | { k: "session"; session: Session }
  | { k: "summary"; session: Session; before: Progress };

const LEVELS = ["A2", "B1", "B2"] as const;
const unitById = (id: string) => units.find((u) => u.id === id)!;
const courseNumber = (id: string) => units.findIndex((u) => u.id === id) + 1;
/** Theory shown before a unit's first lesson; the reading tips are not grammar. */
const introPoints = (u: AppUnit) => u.points.filter((p) => p.id !== "comprensio" && u.theory[p.id]);

export function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
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
  const updatePrefs = (p: Prefs) => {
    savePrefs(p);
    setPrefs(p);
  };
  /** A unit's first lesson opens with its theory cards; the rest go straight to exercises. */
  const startLesson = (unit: AppUnit, lesson: number) =>
    lesson === 1 && !progress.lessons[lessonKey(unit.id, 1)] && introPoints(unit).length > 0
      ? push({ k: "intro", id: unit.id })
      : push({ k: "session", session: lessonSession(unit, lesson) });
  const finish = (session: Session) => {
    const before = progress;
    update(applySession(progress, session, items, new Date()));
    replace({ k: "summary", session, before });
  };

  const screen = stack.at(-1)!;
  switch (screen.k) {
    case "home":
      return <Home progress={progress} push={push} startLesson={startLesson} />;
    case "unit":
      return <UnitScreen unit={unitById(screen.id)} progress={progress} push={push} startLesson={startLesson} back={back} />;
    case "theory":
      return <TheoryScreen unit={unitById(screen.id)} back={back} />;
    case "vocab":
      return <VocabScreen unit={unitById(screen.id)} back={back} />;
    case "settings":
      return <Settings progress={progress} update={update} prefs={prefs} updatePrefs={updatePrefs} back={back} />;
    case "intro":
      return <Intro unit={unitById(screen.id)} onExit={back} onStart={() => replace({ k: "session", session: lessonSession(unitById(screen.id), 1) })} />;
    case "session":
      return (
        <SessionScreen
          key={`${screen.session.unitId ?? "review"}#${screen.session.lesson ?? 0}`}
          initial={screen.session}
          prefs={prefs}
          flagged={progress.flagged}
          onFlag={(id) => update({ ...progress, flagged: progress.flagged.includes(id) ? progress.flagged.filter((f) => f !== id) : [...progress.flagged, id] })}
          onExit={back}
          onFinish={finish}
        />
      );
    case "summary":
      return <Summary session={screen.session} before={screen.before} after={progress} prefs={prefs} onDone={home} />;
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

/** One dot per lesson: how far into the unit you are, without a number to read. */
function LessonDots({ total, done }: { total: number; done: number }) {
  return (
    <span className="dots" aria-label={`${done} de ${total} lliçons`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`dot${i < done ? " is-done" : i === done ? " is-next" : ""}`} />
      ))}
    </span>
  );
}

function Streak({ progress }: { progress: Progress }) {
  const now = new Date();
  const days = streak(progress.days, now);
  const today = progress.days.includes(localDate(now));
  return (
    <span className={`streak${today ? " is-lit" : ""}`} aria-label={`Ratxa: ${days} ${days === 1 ? "dia" : "dies"}${today ? "" : "; avui encara no"}`}>
      <Sprite anim={focAnim} still={focStill} size={30} animate={today} />
      {days}
    </span>
  );
}

function Home({ progress, push, startLesson }: { progress: Progress; push: (s: Screen) => void; startLesson: (u: AppUnit, n: number) => void }) {
  const now = new Date();
  const next = nextLesson(units, progress);
  const review = reviewSession(units, progress, now);
  const due = duePoints(progress, now).length;
  // With many units the current one is often off screen: bring it into view on arrival.
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="screen home">
      <TopBar>
        <Streak progress={progress} />
        <button className="icon-btn" onClick={() => push({ k: "settings" })} aria-label="Ajustos">
          <Icon name="menu" />
        </button>
      </TopBar>
      {next ? (
        <section className={`hero level-${next.unit.level}`}>
          <Sprite anim={dracAnim} still={dracStill} size={96} className="hero-drac" />
          <div className="hero-body">
            <p className="hero-title">
              <Rich text={next.unit.title} />
            </p>
            <LessonDots total={next.unit.lessons.length} done={lessonsDone(next.unit, progress)} />
          </div>
          <button className="btn btn-light continue" onClick={() => startLesson(next.unit, next.lesson)}>
            Continua
          </button>
        </section>
      ) : (
        <section className="hero level-done">
          <Sprite anim={dracAnim} still={dracStill} size={96} className="hero-drac" />
          <p className="hero-title">Has acabat el curs</p>
        </section>
      )}
      {review.size > 0 && (
        <button className="btn btn-secondary review" onClick={() => push({ k: "session", session: review })}>
          Repàs <span className="count">{due}</span>
        </button>
      )}
      <main className="units">
        {LEVELS.map((level) => {
          const list = units.filter((u) => u.level === level);
          if (list.length === 0) return null;
          return (
            <section key={level} className={`level level-${level}`}>
              <h2 className="level-name">{level}</h2>
              {list.map((u) => {
                const n = lessonsDone(u, progress);
                return (
                  <button
                    key={u.id}
                    ref={next?.unit.id === u.id ? current : undefined}
                    className={`unit-row${n === u.lessons.length ? " is-done" : ""}`}
                    onClick={() => push({ k: "unit", id: u.id })}
                  >
                    <span className="unit-n">{courseNumber(u.id)}</span>
                    <span className="unit-title">
                      <Rich text={u.title} />
                    </span>
                    <Panot filled={n} total={u.lessons.length} size={36} />
                  </button>
                );
              })}
            </section>
          );
        })}
      </main>
    </div>
  );
}

function UnitScreen({
  unit,
  progress,
  push,
  startLesson,
  back,
}: {
  unit: AppUnit;
  progress: Progress;
  push: (s: Screen) => void;
  startLesson: (u: AppUnit, n: number) => void;
  back: () => void;
}) {
  return (
    <div className="screen unit">
      <TopBar onBack={back} />
      <main>
        <div className={`unit-hero level-${unit.level}`}>
          <Panot filled={lessonsDone(unit, progress)} total={unit.lessons.length} size={72} />
          <h1>
            <Rich text={unit.title} />
          </h1>
          <p>
            <Rich text={unit.summary} />
          </p>
        </div>
        <div className="unit-links">
          <button className="btn btn-secondary" onClick={() => push({ k: "theory", id: unit.id })}>
            Teoria
          </button>
          {unit.vocabulary.length > 0 && (
            <button className="btn btn-secondary" onClick={() => push({ k: "vocab", id: unit.id })}>
              Vocabulari
            </button>
          )}
        </div>
        <ol className="lessons">
          {unit.lessons.map((l, i) => {
            const isDone = Boolean(progress.lessons[lessonKey(unit.id, i + 1)]);
            return (
              <li key={i}>
                <button className={`lesson-row${isDone ? " is-done" : ""}`} onClick={() => startLesson(unit, i + 1)}>
                  <span className="lesson-n" aria-label={isDone ? "Feta" : undefined}>
                    {isDone ? <Icon name="check" /> : i + 1}
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
          <section key={p.id} className="theory-card">
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

/** The unit's theory as short cards, one per point, before its first lesson. */
function Intro({ unit, onStart, onExit }: { unit: AppUnit; onStart: () => void; onExit: () => void }) {
  const points = introPoints(unit);
  const [i, setI] = useState(0);
  const last = i === points.length - 1;
  return (
    <div className="screen intro">
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Surt">
          <Icon name="close" />
        </button>
        <LessonDots total={points.length} done={i} />
      </header>
      <main key={points[i]!.id} className="intro-card prose enter" dangerouslySetInnerHTML={{ __html: unit.theory[points[i]!.id] ?? "" }} />
      <div className="bottom-bar">
        {last ? (
          <button className="btn btn-primary" onClick={onStart}>
            Comença
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setI(i + 1)}>
            Següent
          </button>
        )}
      </div>
    </div>
  );
}

function SessionScreen({
  initial,
  prefs,
  flagged,
  onFlag,
  onExit,
  onFinish,
}: {
  initial: Session;
  prefs: Prefs;
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

  const onResult = (r: Result) => {
    cue(r.verdict === "wrong" ? "wrong" : "correct", prefs);
    setResult(r);
  };
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
  const progress = sessionProgress(session);
  return (
    <div className="screen session">
      <header className="topbar">
        <button className="icon-btn" onClick={exit} aria-label="Surt">
          <Icon name="close" />
        </button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="progress-fill" style={{ width: `${Math.max(progress * 100, 4)}%` }} />
        </div>
      </header>
      <main className={result?.verdict === "wrong" ? "shake" : undefined}>
        <Exercise key={`${item.id}:${turn}`} item={item} done={result !== null} onResult={onResult} />
      </main>
      {result && (
        <Feedback
          result={result}
          explanation={item.explanation}
          flagged={flagged.includes(item.id)}
          onFlag={() => onFlag(item.id)}
          onTheory={point && unit.theory[point.id] ? () => setTheoryOpen(true) : undefined}
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
  onTheory?: () => void;
  onNext: () => void;
}) {
  const ok = result.verdict !== "wrong";
  const [why, setWhy] = useState(false);
  const note = result.notes?.includes("accent") ? "Compte amb l'accent:" : result.notes?.includes("typo") ? "S'escriu així:" : null;
  // A wrong answer always says why (its own reason, or the rule); a right one keeps the rule one tap away.
  const reason = !ok ? (result.why ?? explanation) : null;
  const more = !ok && result.why ? explanation : ok ? explanation : null;
  return (
    <section className={`sheet ${ok ? "is-ok" : "is-bad"}`} role="status">
      <div className="sheet-inner">
        <div className="sheet-head">
          <img className={`sheet-drac${ok ? " is-happy" : " is-sad"}`} src={dracStill} alt="" width={52} height={52} />
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
        {reason && (
          <p className="why">
            <Rich text={reason} />
          </p>
        )}
        {(more || onTheory) &&
          (why ? (
            <div className="more">
              {more && (
                <p className="explanation">
                  <Rich text={more} />
                </p>
              )}
              {onTheory && (
                <button className="link" onClick={onTheory}>
                  Teoria
                </button>
              )}
            </div>
          ) : (
            <button className="link" onClick={() => setWhy(true)}>
              Per què?
            </button>
          ))}
        <button className={`btn ${ok ? "btn-ok" : "btn-bad"} sheet-next`} autoFocus onClick={onNext}>
          Continua
        </button>
      </div>
    </section>
  );
}

function Summary({ session, before, after, prefs, onDone }: { session: Session; before: Progress; after: Progress; prefs: Prefs; onDone: () => void }) {
  const right = Object.values(session.firstTry).filter((v) => v !== "wrong").length;
  const unit = session.unitId ? unitById(session.unitId) : null;
  const was = unit ? lessonsDone(unit, before) : 0;
  const now = unit ? lessonsDone(unit, after) : 0;
  const today = localDate(new Date());
  const streakUp = !before.days.includes(today);
  const days = streak(after.days, new Date());
  useEffect(() => {
    celebrate();
    cue(streakUp ? "streak" : "done", prefs);
    // Confetti belongs to this screen: stop it when leaving.
    return stopCelebration;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival
  return (
    <div className="screen summary">
      <main>
        {unit ? (
          <Panot filled={now} total={unit.lessons.length} fresh={now > was ? now - 1 : undefined} size={156} />
        ) : (
          <Sprite anim={dracAnim} still={dracStill} size={156} />
        )}
        <h1>{unit ? <Rich text={unit.title} /> : "Repàs fet"}</h1>
        <p className="score">
          <strong>{right}</strong> de {session.size} a la primera
        </p>
        {streakUp && (
          <p className="streak-up">
            <Sprite anim={focAnim} still={focStill} size={44} />
            <strong>{days}</strong> {days === 1 ? "dia" : "dies"} de ratxa
          </p>
        )}
      </main>
      <div className="bottom-bar">
        <button className="btn btn-primary" autoFocus onClick={onDone}>
          Continua
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Settings({
  progress,
  update,
  prefs,
  updatePrefs,
  back,
}: {
  progress: Progress;
  update: (p: Progress) => void;
  prefs: Prefs;
  updatePrefs: (p: Prefs) => void;
  back: () => void;
}) {
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
        <section className="card">
          <Toggle label="So" on={prefs.sound} onChange={(sound) => updatePrefs({ ...prefs, sound })} />
          <Toggle label="Vibració" on={prefs.vibration} onChange={(vibration) => updatePrefs({ ...prefs, vibration })} />
        </section>
        <section className="card">
          <h2>Còpia del progrés</h2>
          <button className="btn btn-secondary" onClick={() => copy("progress", JSON.stringify(progress))}>
            {copied === "progress" ? "Copiat" : "Copia el progrés"}
          </button>
          <textarea rows={3} value={pasted} placeholder="Enganxa aquí una còpia" aria-label="Còpia del progrés" onChange={(e) => setPasted(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-secondary" disabled={pasted.trim() === ""} onClick={restore}>
            {copied === "restored" ? "Restaurat" : "Restaura"}
          </button>
        </section>
        {progress.flagged.length > 0 && (
          <section className="card">
            <h2>Exercicis marcats ({progress.flagged.length})</h2>
            <button className="btn btn-secondary" onClick={() => copy("flagged", progress.flagged.join("\n"))}>
              {copied === "flagged" ? "Copiat" : "Copia la llista"}
            </button>
            <button className="link" onClick={() => update({ ...progress, flagged: [] })}>
              Buida la llista
            </button>
          </section>
        )}
        <button className="link danger" onClick={() => confirm("S'esborrarà tot el progrés.") && update(emptyProgress())}>
          Esborra el progrés
        </button>
        <p className="credits">Il·lustracions: Noto Emoji de Google (CC BY 4.0).</p>
      </main>
    </div>
  );
}

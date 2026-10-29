import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import units from "virtual:content";
import type { Item } from "../content/schema";
import dracAnim from "./assets/drac.webp";
import dracStill from "./assets/drac.png";
import focAnim from "./assets/foc.webp";
import focStill from "./assets/foc.png";
import { ConfirmDialog } from "./dialog";
import { Exercise, type Result } from "./exercises";
import { celebrate, cue, loadPrefs, savePrefs, stopCelebration, type Prefs, type Theme } from "./fx";
import { emptyProgress, lessonKey, loadProgress, localDate, parseProgress, readCorruptBackup, saveProgress, streak, type Progress } from "./progress";
import { clearDraft, createDraft, loadDraft, saveDraft } from "./session-draft";
import {
  answer,
  duePoints,
  finishSessionOnce,
  lessonsDone,
  lessonSession,
  nextLesson,
  reviewSession,
  sessionProgress,
  unitOfItem,
  type AppUnit,
  type Session,
} from "./session";
import { Transfer } from "./transfer";
import { Icon, Panot, Rich, Sprite } from "./ui";

type Screen =
  | { k: "home" }
  | { k: "unit"; id: string }
  | { k: "theory"; id: string }
  | { k: "vocab"; id: string }
  | { k: "settings" }
  | { k: "intro"; id: string }
  | { k: "session"; session: Session; sessionId: string }
  | { k: "summary"; session: Session; before: Progress };

/** What home shows about a resumable session: display data, not the draft itself. */
interface PendingInfo {
  kind: Session["kind"];
  unitTitle: string;
  courseNumber: number;
  done: number;
  total: number;
}

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
  const [pendingSession, setPendingSession] = useState(() => loadDraft(items));
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const finishing = useRef(false);
  const homeScrollY = useRef(0);

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

  // The resolved theme drives `:root[data-theme]`; "system" follows the OS live.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = prefs.theme === "system" ? (media.matches ? "dark" : "light") : prefs.theme;
      document.documentElement.dataset.theme = resolved;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [prefs.theme]);

  // A new app version waits for an explicit tap on home: never reload mid-session.
  useEffect(() => {
    updateSW.current = registerSW({ onNeedRefresh: () => setNeedRefresh(true) });
  }, []);

  // Home always reflects storage: back-button exits and discards from other screens land here.
  useEffect(() => {
    if (stack.at(-1)?.k === "home") setPendingSession(loadDraft(items));
  }, [stack, items]);

  const update = (p: Progress) => {
    saveProgress(p);
    setProgress(p);
  };
  const updatePrefs = (p: Prefs) => {
    savePrefs(p);
    setPrefs(p);
  };
  /** Mints (or keeps, when resuming) the draft id; refuses to pave over another pending session. */
  const prepareSession = (session: Session, sessionId?: string): string | null => {
    const existing = loadDraft(items);
    if (existing && existing.id !== sessionId) return null;
    const id = sessionId ?? createDraft(session).id;
    saveDraft(id, session);
    setPendingSession({ id, session });
    return id;
  };
  const openSession = (session: Session, sessionId?: string) => {
    const id = prepareSession(session, sessionId);
    if (id) push({ k: "session", session, sessionId: id });
  };
  /** A unit's first lesson opens with its theory cards; the rest go straight to exercises. */
  const startLesson = (unit: AppUnit, lesson: number) => {
    if (loadDraft(items)) {
      // A pending session must be resolved from home first: take the user to the resume card.
      if (stack.length > 1) home();
      return;
    }
    if (lesson === 1 && !progress.lessons[lessonKey(unit.id, 1)] && introPoints(unit).length > 0) {
      push({ k: "intro", id: unit.id });
      return;
    }
    openSession(lessonSession(unit, lesson));
  };
  const startIntroSession = (unit: AppUnit) => {
    const session = lessonSession(unit, 1);
    const id = prepareSession(session);
    if (id) replace({ k: "session", session, sessionId: id });
  };
  /** Applies the session exactly once, then shows the summary. Double taps and crashes are safe. */
  const finish = (session: Session, sessionId: string) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const before = progress;
      update(finishSessionOnce(progress, session, sessionId, items, new Date()));
      clearDraft(sessionId);
      setPendingSession(null);
      replace({ k: "summary", session, before });
    } finally {
      finishing.current = false;
    }
  };

  const pushFromHome = (screen: Screen) => {
    homeScrollY.current = window.scrollY;
    push(screen);
  };
  const startFromHome = (unit: AppUnit, lesson: number) => {
    homeScrollY.current = window.scrollY;
    startLesson(unit, lesson);
  };
  const resumeFromHome = () => {
    if (!pendingSession) return;
    homeScrollY.current = window.scrollY;
    openSession(pendingSession.session, pendingSession.id);
  };
  const discardFromHome = () => {
    if (!pendingSession) return;
    clearDraft(pendingSession.id);
    setPendingSession(null);
  };
  const startReviewFromHome = (session: Session) => {
    homeScrollY.current = window.scrollY;
    openSession(session);
  };
  const pending: PendingInfo | null = pendingSession
    ? {
        kind: pendingSession.session.kind,
        unitTitle: pendingSession.session.unitId ? (units.find((u) => u.id === pendingSession.session.unitId)?.title ?? "") : "",
        courseNumber: pendingSession.session.unitId ? courseNumber(pendingSession.session.unitId) : 0,
        done: Object.keys(pendingSession.session.firstTry).length,
        total: pendingSession.session.size,
      }
    : null;

  const screen = stack.at(-1)!;
  switch (screen.k) {
    case "home":
      return (
        <>
          {needRefresh && (
            <div className="update-bar" role="status">
              <span>Hi ha una nova versió disponible.</span>
              <button className="btn btn-secondary" onClick={() => void updateSW.current?.(true)}>
                Actualitza
              </button>
            </div>
          )}
          <Home
            progress={progress}
            push={pushFromHome}
            startLesson={startFromHome}
            restoreScroll={homeScrollY.current}
            pending={pending}
            onResume={resumeFromHome}
            onDiscard={discardFromHome}
            onReview={startReviewFromHome}
          />
        </>
      );
    case "unit":
      return <UnitScreen unit={unitById(screen.id)} progress={progress} push={push} startLesson={startLesson} back={back} />;
    case "theory":
      return <TheoryScreen unit={unitById(screen.id)} back={back} />;
    case "vocab":
      return <VocabScreen unit={unitById(screen.id)} back={back} />;
    case "settings":
      return <Settings progress={progress} update={update} prefs={prefs} updatePrefs={updatePrefs} items={items} back={back} />;
    case "intro":
      return <Intro unit={unitById(screen.id)} onExit={back} onStart={() => startIntroSession(unitById(screen.id))} />;
    case "session":
      return (
        <SessionScreen
          key={screen.sessionId}
          initial={screen.session}
          sessionId={screen.sessionId}
          prefs={prefs}
          flagged={progress.flagged}
          onFlag={(id) => update({ ...progress, flagged: progress.flagged.includes(id) ? progress.flagged.filter((f) => f !== id) : [...progress.flagged, id] })}
          onExit={() => {
            setPendingSession(loadDraft(items));
            back();
          }}
          onCheckpoint={(after) => saveDraft(screen.sessionId, after)}
          onFinish={finish}
        />
      );
    case "summary":
      return <Summary session={screen.session} before={screen.before} after={progress} prefs={prefs} items={items} onDone={home} />;
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

function Home({
  progress,
  push,
  startLesson,
  restoreScroll,
  pending,
  onResume,
  onDiscard,
  onReview,
}: {
  progress: Progress;
  push: (s: Screen) => void;
  startLesson: (u: AppUnit, n: number) => void;
  restoreScroll: number;
  pending: PendingInfo | null;
  onResume: () => void;
  onDiscard: () => void;
  onReview: (s: Session) => void;
}) {
  const now = new Date();
  const next = nextLesson(units, progress);
  const review = reviewSession(units, progress, now);
  const due = duePoints(progress, now).length;
  // Back from a pushed screen: land where the list was, instead of jumping to the current unit.
  useLayoutEffect(() => {
    window.scrollTo(0, restoreScroll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival
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
          <button className="btn btn-light continue" disabled={pending !== null} onClick={() => startLesson(next.unit, next.lesson)}>
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
        <button
          className="btn btn-secondary review"
          disabled={pending !== null}
          onClick={() => onReview(review)}
          aria-label={`Repàs: ${due} ${due === 1 ? "punt pendent" : "punts pendents"}`}
        >
          Repàs <span className="count">{due}</span>
        </button>
      )}
      {pending && (
        <section className="resume-card" aria-label="Sessió pendent">
          <p className="resume-title">{pending.kind === "review" ? "Tens un repàs pendent" : "Tens una lliçó pendent"}</p>
          <p className="resume-meta">
            {pending.kind === "lesson" && pending.unitTitle !== "" && (
              <>
                Unitat {pending.courseNumber} — <Rich text={pending.unitTitle} /> ·{" "}
              </>
            )}
            {pending.done} de {pending.total} exercicis treballats
          </p>
          <div className="resume-actions">
            <button className="btn btn-primary" onClick={onResume}>
              {pending.kind === "review" ? "Reprèn el repàs" : "Reprèn la lliçó"}
            </button>
            <button className="resume-discard" onClick={onDiscard}>
              {pending.kind === "review" ? "Descarta'l" : "Descarta-la"}
            </button>
          </div>
        </section>
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
                    className={`unit-row${n === u.lessons.length ? " is-done" : ""}`}
                    disabled={pending !== null}
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
  // Long cards start at the top when moving between them.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [i]);
  return (
    <div className="screen intro">
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="Surt">
          <Icon name="close" />
        </button>
        <LessonDots total={points.length} done={i} />
      </header>
      <main key={points[i]!.id} className="intro-card prose enter" dangerouslySetInnerHTML={{ __html: unit.theory[points[i]!.id] ?? "" }} />
      <div className="bottom-bar intro-actions">
        {i > 0 && (
          <button className="btn btn-secondary" onClick={() => setI((current) => Math.max(0, current - 1))}>
            Anterior
          </button>
        )}
        <button className="btn btn-primary" onClick={last ? onStart : () => setI((current) => Math.min(points.length - 1, current + 1))}>
          {last ? "Comença" : "Següent"}
        </button>
      </div>
    </div>
  );
}

function SessionScreen({
  initial,
  sessionId,
  prefs,
  flagged,
  onFlag,
  onExit,
  onCheckpoint,
  onFinish,
}: {
  initial: Session;
  sessionId: string;
  prefs: Prefs;
  flagged: string[];
  onFlag: (id: string) => void;
  onExit: () => void;
  /** Persists the session after each answer; false when the write fails. */
  onCheckpoint: (s: Session) => boolean;
  onFinish: (s: Session, id: string) => void;
}) {
  const [session, setSession] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [turn, setTurn] = useState(0);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [checkpointSaved, setCheckpointSaved] = useState(true);
  const item = session.queue[0];
  if (!item) return null;

  const onResult = (r: Result) => {
    cue(r.verdict === "wrong" ? "wrong" : "correct", prefs);
    setResult(r);
  };
  const next = () => {
    if (!result) return;
    const after = answer(session, result.verdict);
    if (after.queue.length === 0) {
      onFinish(after, sessionId);
      return;
    }
    setCheckpointSaved(onCheckpoint(after));
    setSession(after);
    setResult(null);
    setTheoryOpen(false);
    setTurn((t) => t + 1);
  };
  const exit = () => {
    if (Object.keys(session.firstTry).length === 0) {
      // Nothing answered yet: leave no draft behind.
      clearDraft(sessionId);
      onExit();
    } else {
      setConfirmExit(true);
    }
  };
  const unit = unitById(unitOfItem(item.id));
  const point = unit.points.find((p) => p.id === item.point);
  const progress = sessionProgress(session);
  const pct = Math.round(progress * 100);
  return (
    <div className="screen session">
      <header className="topbar">
        <button className="icon-btn" onClick={exit} aria-label="Surt">
          <Icon name="close" />
        </button>
        <div
          className="progress"
          role="progressbar"
          aria-label="Progrés de la sessió"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct} per cent`}
        >
          <div className="progress-fill" style={{ width: `${Math.max(progress * 100, 4)}%` }} />
        </div>
      </header>
      <main className={result?.verdict === "wrong" ? "shake" : undefined}>
        {!checkpointSaved && (
          <p className="error" role="alert">
            No s'ha pogut desar la sessió: no es podrà reprendre.
          </p>
        )}
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
      <ConfirmDialog
        open={confirmExit}
        title="Surt de la sessió?"
        description="Podràs reprendre-la on l'has deixada."
        confirmLabel="Surt"
        onConfirm={onExit}
        onCancel={() => setConfirmExit(false)}
      />
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
  // A wrong typed answer shows what was submitted next to what was expected; accepted keeps the solution line.
  const comparison =
    result.verdict === "wrong" && result.submitted && result.expected ? { submitted: result.submitted, expected: result.expected } : null;
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
        {comparison ? (
          <div className="answer-comparison">
            <div>
              <span className="comparison-label">La teva resposta</span>
              <p className="comparison-value">{comparison.submitted}</p>
            </div>
            <div>
              <span className="comparison-label">Forma esperada</span>
              <p className="comparison-value is-correct">
                <Rich text={comparison.expected} />
              </p>
            </div>
          </div>
        ) : (
          result.expected && (note || !ok) && (
            <p className="solution">
              {note && <span className="note">{note} </span>}
              <Rich text={result.expected} />
            </p>
          )
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

function Summary({
  session,
  before,
  after,
  prefs,
  items,
  onDone,
}: {
  session: Session;
  before: Progress;
  after: Progress;
  prefs: Prefs;
  items: Map<string, Item>;
  onDone: () => void;
}) {
  const right = Object.values(session.firstTry).filter((v) => v !== "wrong").length;
  const unit = session.unitId ? unitById(session.unitId) : null;
  const was = unit ? lessonsDone(unit, before) : 0;
  const now = unit ? lessonsDone(unit, after) : 0;
  const today = localDate(new Date());
  const streakUp = !before.days.includes(today);
  const days = streak(after.days, new Date());
  const practicedPoints = new Set(
    Object.keys(session.firstTry)
      .map((id) => items.get(id))
      .filter((item): item is Item => Boolean(item))
      .map((item) => `${unitOfItem(item.id)}/${item.point}`),
  ).size;
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
        <p className="practiced-points">{practicedPoints === 1 ? "Has practicat 1 punt gramatical" : `Has practicat ${practicedPoints} punts gramaticals`}</p>
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

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "Automàtic" },
  { id: "light", label: "Clar" },
  { id: "dark", label: "Fosc" },
];

function Settings({
  progress,
  update,
  prefs,
  updatePrefs,
  items,
  back,
}: {
  progress: Progress;
  update: (p: Progress) => void;
  prefs: Prefs;
  updatePrefs: (p: Prefs) => void;
  items: Map<string, Item>;
  back: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"delete" | "clearFlagged" | null>(null);
  // Bytes that stopped parsing as a progress, sheltered by progress.ts; read once, on arrival.
  const [corruptBackup] = useState(() => (typeof window === "undefined" ? null : readCorruptBackup()));
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
  const unflag = (id: string) => update({ ...progress, flagged: progress.flagged.filter((itemId) => itemId !== id) });
  return (
    <div className="screen settings">
      <TopBar onBack={back} title="Ajustos" />
      <main>
        <section className="card">
          <Toggle label="So" on={prefs.sound} onChange={(sound) => updatePrefs({ ...prefs, sound })} />
          <Toggle label="Vibració" on={prefs.vibration} onChange={(vibration) => updatePrefs({ ...prefs, vibration })} />
        </section>
        <section className="card">
          <fieldset className="theme-group">
            <legend>Aparença</legend>
            {THEMES.map((t) => (
              <label key={t.id}>
                <input type="radio" name="theme" value={t.id} checked={prefs.theme === t.id} onChange={() => updatePrefs({ ...prefs, theme: t.id })} />
                {t.label}
              </label>
            ))}
          </fieldset>
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
          <Transfer progress={progress} update={update} />
          {corruptBackup && (
            <p className="corrupt-note" role="note">
              S'ha trobat una còpia del progrés que no es pot llegir. Se n'ha desat una còpia de seguretat en aquest dispositiu.
            </p>
          )}
        </section>
        {progress.flagged.length > 0 && (
          <section className="card">
            <h2>Exercicis marcats ({progress.flagged.length})</h2>
            <ul className="flagged-list">
              {progress.flagged.map((id) => {
                const item = items.get(id);
                const unit = units.find((u) => u.id === unitOfItem(id));
                return (
                  <li key={id} className="flagged-item">
                    <span className="flagged-id">{id}</span>
                    <span className="flagged-meta">
                      {item && unit ? (
                        <>
                          Unitat {courseNumber(unit.id)} · <Rich text={unit.title} />
                        </>
                      ) : (
                        "Exercici no disponible"
                      )}
                    </span>
                    <button className="link" onClick={() => unflag(id)}>
                      Desmarca
                    </button>
                  </li>
                );
              })}
            </ul>
            <button className="btn btn-secondary" onClick={() => copy("flagged", progress.flagged.join("\n"))}>
              {copied === "flagged" ? "Copiat" : "Copia la llista"}
            </button>
            <button className="link" onClick={() => setDialog("clearFlagged")}>
              Buida la llista
            </button>
          </section>
        )}
        <button className="link danger" onClick={() => setDialog("delete")}>
          Esborra el progrés
        </button>
        <p className="credits">Il·lustracions: Noto Emoji de Google (CC BY 4.0).</p>
      </main>
      <ConfirmDialog
        open={dialog === "delete"}
        title="Esborra el progrés?"
        description="S'esborrarà tot el progrés d'aquest dispositiu. Aquesta acció no es pot desfer."
        confirmLabel="Esborra"
        onConfirm={() => {
          update(emptyProgress());
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "clearFlagged"}
        title="Buida la llista?"
        description="Es desmarcaran tots els exercicis."
        confirmLabel="Buida"
        onConfirm={() => {
          update({ ...progress, flagged: [] });
          setDialog(null);
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

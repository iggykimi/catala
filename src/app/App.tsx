import { App as CapApp } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";
import units from "virtual:content";
import type { Item } from "../content/schema";
import dracAnim from "./assets/drac.webp";
import dracStill from "./assets/drac.png";
import focAnim from "./assets/foc.webp";
import focStill from "./assets/foc.png";
import { ConfirmDialog, TheoryDialog } from "./dialog";
import { Exercise, type Result } from "./exercises";
import { celebrate, cue, loadPrefs, savePrefs, stopCelebration, type Prefs, type Theme } from "./fx";
import { emptyProgress, lessonKey, loadProgress, localDate, newProgressEpoch, parseProgress, readCorruptBackup, saveProgress, streak, type Progress } from "./progress";
import { clearDraft, createDraft, DRAFT_KEY, draftStatus, loadDraft, saveDraft } from "./session-draft";
import {
  answer,
  duePoints,
  finishSessionOnce,
  lessonsDone,
  lessonSession,
  nextLesson,
  reviewSession,
  sessionProgress,
  shouldAutoAdvance,
  unitOfItem,
  type AppUnit,
  type Session,
} from "./session";
import { importDetails, Transfer } from "./transfer";
import { Icon, Panot, Rich, Sprite } from "./ui";

type Screen =
  | { k: "home" }
  | { k: "unit"; id: string }
  | { k: "theory"; id: string }
  | { k: "vocab"; id: string }
  | { k: "settings" }
  | { k: "intro"; id: string }
  | { k: "session"; session: Session; sessionId: string; initiallyPersisted: boolean }
  | { k: "summary"; session: Session; before: Progress };

/** A started session: the draft id plus whether its first write reached storage. */
interface PreparedSession {
  id: string;
  persisted: boolean;
}

/**
 * A back-press interceptor registered by the top screen. It closes the topmost
 * modal (or asks for exit confirmation) and returns true when the press was
 * consumed; false lets the history navigation proceed.
 */
type BackHandler = () => boolean;

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
  const [pendingSession, setPendingSession] = useState(() => loadDraft(items, loadProgress().progressEpoch));
  // Stored bytes that are not a resumable draft of this progress generation (P1.3).
  const [draftUnusable, setDraftUnusable] = useState(() => draftStatus(items, loadProgress().progressEpoch) === "unusable");
  // A finish whose save failed: the session screen stays up so the learner can retry.
  const [finishError, setFinishError] = useState<string | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const finishing = useRef(false);
  const homeScrollY = useRef(0);
  // Back-press interceptors from the top screen (session exit, open dialogs).
  const backHandlers = useRef<BackHandler[]>([]);
  const registerBack = useCallback((handler: BackHandler): (() => void) => {
    backHandlers.current.push(handler);
    return () => {
      backHandlers.current = backHandlers.current.filter((h) => h !== handler);
    };
  }, []);

  // The browser history mirrors the screen stack, so the Android back button goes back a screen.
  // A consumed press re-pushes the popped entry, keeping history and the stack in sync.
  useEffect(() => {
    history.replaceState({ d: 0 }, "");
    const onPop = (e: PopStateEvent) => {
      const d = (e.state as { d?: number } | null)?.d ?? 0;
      for (let i = backHandlers.current.length - 1; i >= 0; i--) {
        if (backHandlers.current[i]!()) {
          history.pushState({ d: d + 1 }, "");
          return;
        }
      }
      setStack((s) => s.slice(0, d + 1));
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  // Native Android back: drive the same interceptor chain explicitly instead of relying on
  // WebView history alone (a consumed press changes no history here; deeper stacks pop through
  // history.back() so the popstate path stays the single slicing mechanism). On web/PWA the
  // listener never fires and the popstate path above owns back, as covered by e2e.
  const stackRef = useRef(stack);
  stackRef.current = stack;
  useEffect(() => {
    let handle: PluginListenerHandle | null = null;
    let cancelled = false;
    CapApp.addListener("backButton", () => {
      for (let i = backHandlers.current.length - 1; i >= 0; i--) {
        if (backHandlers.current[i]!()) return;
      }
      if (stackRef.current.length > 1) history.back();
      else void CapApp.exitApp();
    })
      .then((h) => {
        if (cancelled) void h.remove();
        else handle = h;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      handle?.remove().catch(() => {});
    };
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
    if (stack.at(-1)?.k === "home") {
      setPendingSession(loadDraft(items, progress.progressEpoch));
      setDraftUnusable(draftStatus(items, progress.progressEpoch) === "unusable");
    }
  }, [stack, items, progress.progressEpoch]);

  const update = (p: Progress) => {
    saveProgress(p);
    setProgress(p);
  };
  /**
   * Full replacement (erase, paste restore, file import): stamps a fresh
   * progress generation so any surviving draft bytes can never resume, then
   * removes the draft and syncs React state. False on storage failure, in
   * which case the caller must not claim success.
   */
  const replaceAllProgress = (next: Progress): boolean => {
    try {
      const stamped = { ...next, progressEpoch: newProgressEpoch() };
      saveProgress(stamped);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // The draft bytes may survive, but the new epoch already invalidates them.
      }
      setProgress(stamped);
      setPendingSession(loadDraft(items, stamped.progressEpoch));
      setDraftUnusable(draftStatus(items, stamped.progressEpoch) === "unusable");
      return true;
    } catch (error) {
      console.error("Cannot replace progress", error);
      return false;
    }
  };
  const updatePrefs = (p: Prefs) => {
    savePrefs(p);
    setPrefs(p);
  };
  /**
   * Mints (or keeps, when resuming) the draft id; refuses to pave over another
   * pending session or over unreadable bytes. Rationale: silently overwriting an
   * unusable draft would destroy potentially diagnostic state and hide a storage
   * problem behind a fresh session, so the learner explicitly discards it from
   * home first; until then no new session starts.
   */
  const prepareSession = (session: Session, sessionId?: string): PreparedSession | null => {
    if (draftStatus(items, progress.progressEpoch) === "unusable") return null;
    const existing = loadDraft(items, progress.progressEpoch);
    if (existing && existing.id !== sessionId) return null;
    const id = sessionId ?? createDraft(session, progress.progressEpoch).id;
    const persisted = saveDraft(id, session, progress.progressEpoch);
    if (persisted) {
      setPendingSession({ id, session });
    } else {
      // Do not claim that this session can be recovered.
      setPendingSession(null);
    }
    return { id, persisted };
  };
  const openSession = (session: Session, sessionId?: string) => {
    const prepared = prepareSession(session, sessionId);
    if (!prepared) return;
    finishing.current = false;
    setFinishError(null);
    push({ k: "session", session, sessionId: prepared.id, initiallyPersisted: prepared.persisted });
  };
  /** A unit's first lesson opens with its theory cards; the rest go straight to exercises. */
  const startLesson = (unit: AppUnit, lesson: number) => {
    const status = draftStatus(items, progress.progressEpoch);
    if (status !== "none") {
      // A pending (or unreadable) draft must be resolved from home first.
      setPendingSession(loadDraft(items, progress.progressEpoch));
      setDraftUnusable(status === "unusable");
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
    const prepared = prepareSession(session);
    if (!prepared) return;
    finishing.current = false;
    setFinishError(null);
    replace({ k: "session", session, sessionId: prepared.id, initiallyPersisted: prepared.persisted });
  };
  /**
   * Applies the session exactly once, then shows the summary. The lock stays
   * held until a new session starts: an immediate unlock would reopen the race
   * before React leaves the session screen. A save failure unlocks instead and
   * keeps the session up with a retryable error.
   */
  const finish = (session: Session, sessionId: string) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const before = progress;
      const after = finishSessionOnce(progress, session, sessionId, items, new Date());
      // Synchronous storage commit before touching the draft or navigating.
      saveProgress(after);
      setProgress(after);
      clearDraft(sessionId);
      setPendingSession(null);
      setFinishError(null);
      replace({ k: "summary", session, before });
      // Do not unlock here: openSession/startIntroSession reset the lock.
    } catch (error) {
      finishing.current = false;
      console.error("Cannot save finished session", error);
      setFinishError("No s'ha pogut desar el resultat. Torna-ho a provar.");
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
  /** Explicit discard of unreadable draft bytes; removes the key outright. */
  const discardUnusableFromHome = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Storage unavailable: the note stays until the next successful sync.
      return;
    }
    setDraftUnusable(false);
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
            unusable={draftUnusable}
            onResume={resumeFromHome}
            onDiscard={discardFromHome}
            onDiscardUnusable={discardUnusableFromHome}
            onReview={startReviewFromHome}
            registerBack={registerBack}
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
      return (
        <Settings
          progress={progress}
          update={update}
          replaceProgress={replaceAllProgress}
          prefs={prefs}
          updatePrefs={updatePrefs}
          items={items}
          back={back}
          registerBack={registerBack}
        />
      );
    case "intro":
      return <Intro unit={unitById(screen.id)} onExit={back} onStart={() => startIntroSession(unitById(screen.id))} />;
    case "session":
      return (
        <SessionScreen
          key={screen.sessionId}
          initial={screen.session}
          sessionId={screen.sessionId}
          initiallyPersisted={screen.initiallyPersisted}
          finishError={finishError}
          prefs={prefs}
          flagged={progress.flagged}
          onFlag={(id) => update({ ...progress, flagged: progress.flagged.includes(id) ? progress.flagged.filter((f) => f !== id) : [...progress.flagged, id] })}
          onExit={() => {
            setPendingSession(loadDraft(items, progress.progressEpoch));
            setDraftUnusable(draftStatus(items, progress.progressEpoch) === "unusable");
            back();
          }}
          onCheckpoint={(after) => saveDraft(screen.sessionId, after, progress.progressEpoch)}
          onFinish={finish}
          registerBack={registerBack}
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
  unusable,
  onResume,
  onDiscard,
  onDiscardUnusable,
  onReview,
  registerBack,
}: {
  progress: Progress;
  push: (s: Screen) => void;
  startLesson: (u: AppUnit, n: number) => void;
  restoreScroll: number;
  pending: PendingInfo | null;
  unusable: boolean;
  onResume: () => void;
  onDiscard: () => void;
  onDiscardUnusable: () => void;
  onReview: (s: Session) => void;
  registerBack: (handler: BackHandler) => () => void;
}) {
  const now = new Date();
  const next = nextLesson(units, progress);
  const review = reviewSession(units, progress, now);
  const due = duePoints(progress, now).length;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Back from a pushed screen: land where the list was, instead of jumping to the current unit.
  useLayoutEffect(() => {
    window.scrollTo(0, restoreScroll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival
  useEffect(() => {
    return registerBack(() => {
      if (confirmDiscard) {
        setConfirmDiscard(false);
        return true;
      }
      return false;
    });
  }, [registerBack, confirmDiscard]);
  // A pending or unreadable draft blocks every other entry until resolved.
  const blocked = pending !== null || unusable;
  const requestDiscard = () => {
    if (pending && pending.done > 0) setConfirmDiscard(true);
    else onDiscard();
  };
  return (
    <div className="screen home">
      <TopBar>
        <Streak progress={progress} />
        <button className="icon-btn" onClick={() => push({ k: "settings" })} aria-label="Ajustos">
          <Icon name="menu" />
        </button>
      </TopBar>
      {unusable && !pending && (
        <p className="draft-unusable" role="note">
          Hi ha una sessió desada que no es pot reprendre.{" "}
          <button className="link" onClick={onDiscardUnusable}>
            Descarta-la
          </button>
        </p>
      )}
      {pending ? (
        <section className="resume-card resume-hero" aria-label="Sessió pendent">
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
            <button className="resume-discard" onClick={requestDiscard}>
              {pending.kind === "review" ? "Descarta'l" : "Descarta-la"}
            </button>
          </div>
        </section>
      ) : (
        <>
          {next ? (
            <section className={`hero level-${next.unit.level}`}>
              <Sprite anim={dracAnim} still={dracStill} size={96} className="hero-drac" />
              <div className="hero-body">
                <p className="hero-title">
                  <Rich text={next.unit.title} />
                </p>
                <LessonDots total={next.unit.lessons.length} done={lessonsDone(next.unit, progress)} />
              </div>
              <button className="btn btn-light continue" disabled={blocked} onClick={() => startLesson(next.unit, next.lesson)}>
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
              disabled={blocked}
              onClick={() => onReview(review)}
              aria-label={`Repàs: ${due} ${due === 1 ? "punt pendent" : "punts pendents"}`}
            >
              Repàs <span className="count">{due}</span>
            </button>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        title="Descarta la sessió?"
        description="Es perdrà el progrés d'aquesta sessió. Aquesta acció no es pot desfer."
        confirmLabel="Descarta"
        onConfirm={() => {
          setConfirmDiscard(false);
          onDiscard();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
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
                    disabled={blocked}
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
  initiallyPersisted,
  finishError,
  prefs,
  flagged,
  onFlag,
  onExit,
  onCheckpoint,
  onFinish,
  registerBack,
}: {
  initial: Session;
  sessionId: string;
  /** Whether the opening draft write reached storage; false keeps a persistent warning up. */
  initiallyPersisted: boolean;
  /** A failed finish save to report with a retry; null when the last finish held. */
  finishError: string | null;
  prefs: Prefs;
  flagged: string[];
  onFlag: (id: string) => void;
  onExit: () => void;
  /** Persists the session after each answer; false when the write fails. */
  onCheckpoint: (s: Session) => boolean;
  onFinish: (s: Session, id: string) => void;
  registerBack: (handler: BackHandler) => () => void;
}) {
  const [session, setSession] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [turn, setTurn] = useState(0);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [everPersisted, setEverPersisted] = useState(initiallyPersisted);
  const [checkpointSaved, setCheckpointSaved] = useState(true);
  // Set synchronously on confirmed exit so the following popstate is never consumed.
  const confirmedExit = useRef(false);
  const item = session.queue[0];

  // The Android back button follows the same rules as Surt: modals first, then
  // discard an empty session, then confirm leaving a partial one.
  useEffect(() => {
    return registerBack(() => {
      if (confirmedExit.current) return false;
      if (theoryOpen) {
        setTheoryOpen(false);
        return true;
      }
      if (confirmExit) {
        setConfirmExit(false);
        return true;
      }
      if (Object.keys(session.firstTry).length === 0) {
        clearDraft(sessionId);
        return false;
      }
      setConfirmExit(true);
      return true;
    });
  }, [registerBack, theoryOpen, confirmExit, session, sessionId]);

  if (!item) return null;

  const onResult = (r: Result) => {
    cue(r.verdict === "wrong" ? "wrong" : "correct", prefs);
    setResult(r);
  };
  // A clean correct answer shows the verdict briefly, then moves on by itself. The timer dies
  // with the result: leaving the session, answering again or a rerender with a new verdict
  // all cancel it, and warnings/errors always wait for Continua.
  const nextRef = useRef(() => {});
  const autoAdvancing =
    result !== null && shouldAutoAdvance(result.verdict, prefs.autoAdvance, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (!autoAdvancing) return;
    const t = setTimeout(() => nextRef.current(), 900);
    return () => clearTimeout(t);
  }, [autoAdvancing, result]);
  const next = () => {
    if (!result) return;
    const after = answer(session, result.verdict);
    if (after.queue.length === 0) {
      onFinish(after, sessionId);
      return;
    }
    const saved = onCheckpoint(after);
    if (saved) setEverPersisted(true);
    setCheckpointSaved(saved);
    setSession(after);
    setResult(null);
    setTheoryOpen(false);
    setTurn((t) => t + 1);
  };
  nextRef.current = next;
  const exit = () => {
    if (Object.keys(session.firstTry).length === 0) {
      // Nothing answered yet: leave no draft behind.
      clearDraft(sessionId);
      onExit();
    } else {
      setConfirmExit(true);
    }
  };
  const confirmLeave = () => {
    confirmedExit.current = true;
    setConfirmExit(false);
    onExit();
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
        {finishError && (
          <p className="error save-error" role="alert">
            {finishError}
          </p>
        )}
        {!everPersisted ? (
          <p className="error save-error" role="alert">
            No s'ha pogut desar la sessió. Pots continuar, però no es podrà reprendre si surts.
          </p>
        ) : (
          !checkpointSaved && (
            <p className="error save-error" role="alert">
              No s'han pogut desar els últims canvis. Si tanques l'aplicació, pots perdre part de la sessió.
            </p>
          )
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
          autoAdvancing={autoAdvancing}
        />
      )}
      {point && <TheoryDialog open={theoryOpen} html={unit.theory[point.id] ?? ""} onClose={() => setTheoryOpen(false)} />}
      <ConfirmDialog
        open={confirmExit}
        title="Surt de la sessió?"
        description={everPersisted ? "Podràs reprendre-la on l'has deixada." : "Aquesta sessió no s'ha pogut desar: si surts ara, no es podrà reprendre."}
        confirmLabel="Surt"
        onConfirm={confirmLeave}
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
  autoAdvancing,
}: {
  result: Result;
  explanation: string;
  flagged: boolean;
  onFlag: () => void;
  onTheory?: () => void;
  onNext: () => void;
  autoAdvancing: boolean;
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
      </div>
      {!autoAdvancing && (
        <div className="sheet-bar">
          <button className={`btn ${ok ? "btn-ok" : "btn-bad"} sheet-next`} autoFocus onClick={onNext}>
            Continua
          </button>
        </div>
      )}
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

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span>
        {label}
        {hint && <small className="toggle-hint">{hint}</small>}
      </span>
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
  replaceProgress,
  prefs,
  updatePrefs,
  items,
  back,
  registerBack,
}: {
  progress: Progress;
  /** Ordinary in-generation update (flagged marks); never touches the draft. */
  update: (p: Progress) => void;
  /** Full replacement (erase, restore, import); invalidates any pending session. */
  replaceProgress: (next: Progress) => boolean;
  prefs: Prefs;
  updatePrefs: (p: Prefs) => void;
  items: Map<string, Item>;
  back: () => void;
  registerBack: (handler: BackHandler) => () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"delete" | "clearFlagged" | null>(null);
  const [pendingPastedRestore, setPendingPastedRestore] = useState<Progress | null>(null);
  // Bytes that stopped parsing as a progress, sheltered by progress.ts; read once, on arrival.
  const [corruptBackup] = useState(() => (typeof window === "undefined" ? null : readCorruptBackup()));
  useEffect(() => {
    return registerBack(() => {
      if (dialog) {
        setDialog(null);
        return true;
      }
      if (pendingPastedRestore) {
        setPendingPastedRestore(null);
        return true;
      }
      return false;
    });
  }, [registerBack, dialog, pendingPastedRestore]);
  const copy = async (what: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
  };
  // Pasted restore only stages the backup: the same ConfirmDialog as file
  // import asks for confirmation before the full replacement runs.
  const restore = () => {
    const parsed = parseProgress(pasted);
    if (!parsed) {
      setError("Aquest text no és una còpia del progrés.");
      return;
    }
    setError(null);
    setPendingPastedRestore(parsed);
  };
  const unflag = (id: string) => update({ ...progress, flagged: progress.flagged.filter((itemId) => itemId !== id) });
  return (
    <div className="screen settings">
      <TopBar onBack={back} title="Ajustos" />
      <main>
        <section className="card">
          <Toggle label="So" on={prefs.sound} onChange={(sound) => updatePrefs({ ...prefs, sound })} />
          <Toggle label="Vibració" on={prefs.vibration} onChange={(vibration) => updatePrefs({ ...prefs, vibration })} />
          <Toggle
            label="Avanç automàtic"
            hint="Avança sol després d'un encert"
            on={prefs.autoAdvance}
            onChange={(autoAdvance) => updatePrefs({ ...prefs, autoAdvance })}
          />
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
          <Transfer progress={progress} replaceProgress={replaceProgress} registerBack={registerBack} />
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
        description="S'esborrarà tot el progrés d'aquest dispositiu i qualsevol sessió pendent. Aquesta acció no es pot desfer."
        confirmLabel="Esborra"
        onConfirm={() => {
          if (replaceProgress(emptyProgress())) {
            setDialog(null);
          } else {
            setDialog(null);
            setError("No s'ha pogut esborrar el progrés.");
          }
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={pendingPastedRestore !== null}
        title="Restaura el progrés?"
        description={pendingPastedRestore ? importDetails(pendingPastedRestore) : ""}
        confirmLabel="Restaura"
        onConfirm={() => {
          if (!pendingPastedRestore) return;
          if (replaceProgress(pendingPastedRestore)) {
            setPasted("");
            setCopied("restored");
            setPendingPastedRestore(null);
          } else {
            // Close so the failure is visible; the pasted text stays for a retry.
            setPendingPastedRestore(null);
            setError("No s'ha pogut restaurar el progrés.");
          }
        }}
        onCancel={() => setPendingPastedRestore(null)}
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

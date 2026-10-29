// Sound, vibration and confetti: the feedback a learner feels, not reads.
// Sounds are synthesised (no audio files to load or license); each can be turned off.
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import confetti from "canvas-confetti";

export type Theme = "system" | "light" | "dark";

export interface Prefs {
  sound: boolean;
  vibration: boolean;
  theme: Theme;
}

const KEY = "catala.prefs.v1";
const DEFAULTS: Prefs = { sound: true, vibration: true, theme: "system" };

const isTheme = (v: unknown): v is Theme => v === "system" || v === "light" || v === "dark";

export function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
    return {
      sound: typeof raw.sound === "boolean" ? raw.sound : DEFAULTS.sound,
      vibration: typeof raw.vibration === "boolean" ? raw.vibration : DEFAULTS.vibration,
      theme: isTheme(raw.theme) ? raw.theme : DEFAULTS.theme,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(p: Prefs): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

let audio: AudioContext | null = null;

/** One note with a soft attack and decay, so it reads as a chime rather than a beep. */
function note(freq: number, at: number, length: number, type: OscillatorType, volume: number) {
  audio ??= new AudioContext();
  const t = audio.currentTime + at;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

const melodies = {
  correct: () => {
    note(784, 0, 0.16, "sine", 0.18);
    note(1175, 0.09, 0.22, "sine", 0.16);
  },
  wrong: () => {
    note(233, 0, 0.18, "triangle", 0.2);
    note(196, 0.12, 0.26, "triangle", 0.18);
  },
  done: () => [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.3, "sine", 0.16)),
  streak: () => [659, 880, 1319].forEach((f, i) => note(f, i * 0.07, 0.35, "triangle", 0.14)),
};

export type Cue = keyof typeof melodies;

/** Plays the cue as sound and/or vibration, as the learner's settings allow. Never throws. */
export function cue(kind: Cue, prefs: Prefs): void {
  try {
    if (prefs.sound) melodies[kind]();
  } catch {
    // No audio (autoplay policy, old WebView): the visual feedback is still there.
  }
  if (!prefs.vibration) return;
  const haptic =
    kind === "wrong"
      ? Haptics.notification({ type: NotificationType.Error })
      : kind === "correct"
        ? Haptics.impact({ style: ImpactStyle.Light })
        : Haptics.notification({ type: NotificationType.Success });
  haptic.catch(() => {});
}

export function stopCelebration(): void {
  confetti.reset();
}

/** A burst from the lower middle of the screen; off when the system asks for reduced motion. */
export function celebrate(): void {
  void confetti({
    particleCount: 140,
    spread: 80,
    startVelocity: 42,
    origin: { y: 0.65 },
    colors: ["#1e7be0", "#13a89e", "#f5b400", "#ff8a00", "#8b5cf6"],
    disableForReducedMotion: true,
  });
}

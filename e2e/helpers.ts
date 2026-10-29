import { expect, type Page } from "@playwright/test";
import type { Item } from "../src/content/schema";
import { parseInline } from "../src/content/markup";
import { loadUnits } from "../src/content/vite-plugin";
import type { AppUnit } from "../src/app/session";

export const units = loadUnits(process.cwd()) as unknown as AppUnit[];
/** The text a learner sees for a content string (inline markup removed). */
export const plain = (s: string) => s.replace(/\*\*|\*|\[\[|\]\]|~~/g, "");
export const button = (page: Page, name: string) => page.getByRole("button", { name: plain(name), exact: true });
export const check = (page: Page) => page.getByRole("button", { name: "Comprova" }).click();

export async function answerRight(page: Page, item: Item) {
  switch (item.type) {
    case "choice":
      // Tapping the option checks it immediately; only typed answers keep Comprova.
      return page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(item.answer))}$`) }).click();
    case "fill":
      await page.getByLabel("Resposta").fill(item.answers[0]!);
      return check(page);
    case "transform":
      await page.getByLabel("Resposta").fill(item.answers[0]!.slice(item.start?.length ?? 0).trim());
      return check(page);
    case "inline-choice": {
      const gaps = parseInline(item.text).filter((s) => typeof s !== "string");
      for (const [i, g] of gaps.entries()) {
        await page.getByRole("button", { name: `Buit ${i + 1}`, exact: true }).click();
        const opt = g.options[0]!;
        await page.locator(".chips").getByRole("button", { name: opt === "" ? "res" : opt, exact: true }).click();
      }
      return;
    }
    case "find-error": {
      if (item.no_error) return button(page, "No hi ha cap error").click();
      const start = item.sentence.indexOf(item.error!);
      const tokenIndex = [...item.sentence.matchAll(/\S+/g)].findIndex((m) => m.index + m[0].length > start);
      await page.locator(".token").nth(tokenIndex).click();
      return page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(item.fix!))}$`) }).click();
    }
    case "order": {
      // Unused chips only: a duplicate text may belong to a distractor chip.
      for (const c of item.chunks) {
        if ((await page.locator(".sheet-title").count()) > 0) return;
        await page
          .locator(".bank .chip:not(.is-used)")
          .filter({ hasText: new RegExp(`^${escape(c)}$`) })
          .first()
          .click();
      }
      return;
    }
    case "match":
      for (const [l, r] of item.pairs) {
        await page.locator(".match-col").first().getByRole("button", { name: plain(l), exact: true }).click();
        await page.locator(".match-col").last().getByRole("button", { name: plain(r), exact: true }).click();
      }
      return;
    case "reading":
      for (const [qi, q] of item.questions.entries()) {
        await page.locator(".question").nth(qi).locator(".option").filter({ hasText: new RegExp(`^${escape(plain(q.answer))}$`) }).click();
      }
      return;
  }
}

/** Stores prefs before the first navigation; suites pin autoAdvance off for determinism. */
export async function seedPrefs(page: Page, prefs: Record<string, unknown>): Promise<void> {
  await page.addInitScript((p) => {
    localStorage.setItem("catala.prefs.v1", JSON.stringify(p));
  }, prefs);
}

export function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function expectVerdict(page: Page, title: "Correcte" | "Incorrecte") {
  await expect(page.locator(".sheet-title")).toHaveText(title);
}

export async function playLesson(page: Page, queue: Item[]) {
  for (const item of queue) {
    await answerRight(page, item);
    await expectVerdict(page, "Correcte");
    await page.getByRole("button", { name: "Continua", exact: true }).click();
  }
}

/** A unit's first lesson opens with theory cards: page through them and start. */
export async function skipIntro(page: Page) {
  await page.locator(".intro, .ex").first().waitFor();
  if (!(await page.locator(".intro").isVisible())) return;
  while (await page.getByRole("button", { name: "Següent", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "Següent", exact: true }).click();
  }
  await page.getByRole("button", { name: "Comença", exact: true }).click();
}

/** Starts the next lesson from the home screen. */
export async function startNext(page: Page) {
  await page.locator(".continue").click();
  await skipIntro(page);
}

/** Opens one lesson of one unit from home, so a test can cover a single unit. */
export async function openUnitLesson(page: Page, unit: AppUnit, lesson: number) {
  await page.locator(".unit-row", { hasText: plain(unit.title) }).click();
  await page.locator(".lesson-row").nth(lesson - 1).click();
  await skipIntro(page);
}

/** The pending-session card on home, shown when a saved draft exists. */
export const resumeCard = (page: Page) => page.locator(".resume-card");

/** Opens the theory intro of a unit's first lesson from home (fresh progress). */
export async function openIntro(page: Page, unit: AppUnit) {
  await page.locator(".unit-row", { hasText: plain(unit.title) }).click();
  await page.locator(".lesson-row").nth(0).click();
  await page.locator(".intro").waitFor();
}

// ---- Regression-suite seeds (E2E-01..08): fresh-context setup only. ----

/** Stores a progress value before the first navigation of a fresh context. */
export async function seedProgress(page: Page, progress: unknown): Promise<void> {
  await page.addInitScript((p) => {
    localStorage.setItem("catala.progress.v1", JSON.stringify(p));
  }, progress);
}

/** Stores a session draft before the first navigation of a fresh context. */
export async function seedDraft(page: Page, draft: unknown): Promise<void> {
  await page.addInitScript((d) => {
    localStorage.setItem("catala.session.v1", JSON.stringify(d));
  }, draft);
}

/** A valid progress carrying the given lessons, for restore/erase scenarios. */
export function sampleProgress(lessons: Record<string, string>): unknown {
  return { v: 1, lessons, cards: {}, items: {}, days: ["2026-10-20"], flagged: [] };
}

/**
 * A mid-lesson draft: the first `answered` items are recorded as correct and
 * the rest remain queued. Mirrors the app's draft shape (queueIds + firstTry).
 */
export function lessonDraft(unitId: string, lesson: number, answered: number): unknown {
  const ids = units
    .find((u) => u.id === unitId)!
    .items.filter((it) => it.lesson === lesson)
    .map((it) => it.id);
  const done = Math.min(Math.max(answered, 0), ids.length - 1);
  return {
    v: 1,
    id: "regression-seed",
    savedAt: new Date().toISOString(),
    kind: "lesson",
    unitId,
    lesson,
    queueIds: ids.slice(done),
    size: ids.length,
    firstTry: Object.fromEntries(ids.slice(0, done).map((id) => [id, "correct"])),
  };
}

/** Opens Settings from the home top bar and waits for it. */
export async function gotoSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Ajustos" }).click();
  await expect(page.locator(".topbar-title")).toHaveText("Ajustos");
}

/** Reads a raw localStorage value (null when the key is absent). */
export function readStorage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

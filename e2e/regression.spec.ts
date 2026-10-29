// Issue #2 regression scenarios (E2E-01..08): user-level coverage of the wave-2
// contract (unified restore, full progress replace, back-button exits, theory
// focus, theme persistence, resumable sessions). Each test uses a fresh context.
// NOTE: App.tsx lands after this suite, so contract tests FAIL until then.
import { expect, test, type Page } from "@playwright/test";
import type { Progress } from "../src/app/progress";
import { lessonSession } from "../src/app/session";
import {
  answerRight,
  escape,
  expectVerdict,
  gotoSettings,
  lessonDraft,
  plain,
  playLesson,
  readStorage,
  resumeCard,
  sampleProgress,
  seedDraft,
  seedProgress,
  startNext,
  units,
} from "./helpers";

// Reduced motion turns off the entrance animations and the confetti (styles.css, fx.ts),
// so Playwright does not wait out an animation between steps.
test.use({ reducedMotion: "reduce" });

const DRAFT_KEY = "catala.session.v1";
const PROGRESS_KEY = "catala.progress.v1";

const themeOf = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => document.documentElement.dataset.theme);

/** Item id -> [seen, wrong] from the stored progress. */
const statsOf = (page: Page): Promise<Record<string, number[]>> =>
  page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("catala.progress.v1")!) as Progress;
    return Object.fromEntries(Object.entries(p.items).map(([id, s]) => [id, [s.seen, s.wrong]]));
  });

test("E2E-01 erasing progress clears a pending session", async ({ page }) => {
  await page.goto("/");
  // One-shot seed: addInitScript would re-seed on the reload below and defeat the storage assertion.
  await page.evaluate((draft) => localStorage.setItem("catala.session.v1", JSON.stringify(draft)), lessonDraft("a2-01", 1, 3));
  await page.reload();
  await expect(resumeCard(page)).toBeVisible();
  await gotoSettings(page);
  await page.getByRole("button", { name: "Esborra el progrés" }).click();
  const dialog = page.getByRole("dialog", { name: "Esborra el progrés?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Esborra", exact: true }).click();
  await page.getByRole("button", { name: "Enrere" }).click();
  await expect(page.locator(".home")).toBeVisible();
  await expect(resumeCard(page)).toHaveCount(0);
  await page.reload();
  await expect(resumeCard(page)).toHaveCount(0);
  await expect.poll(() => readStorage(page, DRAFT_KEY)).toBeNull();
});

test("E2E-02 restoring a backup replaces progress and drops the old draft", async ({ page }) => {
  await page.goto("/");
  // One-shot seeds: addInitScript would re-seed on the reload below and defeat the storage assertions.
  await page.evaluate(
    ({ progress, draft }) => {
      localStorage.setItem("catala.progress.v1", JSON.stringify(progress));
      localStorage.setItem("catala.session.v1", JSON.stringify(draft));
    },
    { progress: sampleProgress({ "a2-01#1": "2026-10-20T09:00:00.000Z" }), draft: lessonDraft("a2-01", 1, 3) },
  );
  await page.reload();
  await expect(resumeCard(page)).toBeVisible();
  const backup = JSON.stringify(sampleProgress({ "a2-02#1": "2026-10-21T09:00:00.000Z" }));
  await gotoSettings(page);
  await page.getByLabel("Còpia del progrés").fill(backup);
  await page.getByRole("button", { name: "Restaura", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Restaura el progrés?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("1 lliçó completada");
  await expect(dialog).toContainText("Se substituirà el progrés actual.");
  await dialog.getByRole("button", { name: "Restaura", exact: true }).click();
  await expect.poll(() => readStorage(page, PROGRESS_KEY)).toContain("a2-02#1");
  await page.getByRole("button", { name: "Enrere" }).click();
  await expect(page.locator(".home")).toBeVisible();
  await expect(resumeCard(page)).toHaveCount(0);
  await page.reload();
  await expect(resumeCard(page)).toHaveCount(0);
  await expect.poll(() => readStorage(page, PROGRESS_KEY)).toContain("a2-02#1");
});

test("E2E-03 cancelling a restore keeps the original progress and the pasted text", async ({ page }) => {
  await seedProgress(page, sampleProgress({ "a2-01#1": "2026-10-20T09:00:00.000Z" }));
  await page.goto("/");
  const pasted = JSON.stringify(sampleProgress({ "a2-02#1": "2026-10-21T09:00:00.000Z" }));
  await gotoSettings(page);
  const box = page.getByLabel("Còpia del progrés");
  await box.fill(pasted);
  await page.getByRole("button", { name: "Restaura", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Restaura el progrés?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel·la", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(box).toHaveValue(pasted);
  await expect.poll(() => readStorage(page, PROGRESS_KEY)).toContain("a2-01#1");
  await expect.poll(() => readStorage(page, PROGRESS_KEY)).not.toContain("a2-02#1");
});

test("E2E-04 tapping Continua twice at the lesson end applies stats once", async ({ page }) => {
  const unit = units.find((u) => u.id === "a2-01")!;
  const queue = lessonSession(unit, 1).queue;
  await seedDraft(page, lessonDraft("a2-01", 1, queue.length - 1));
  await page.goto("/");
  await resumeCard(page).getByRole("button", { name: /Reprèn/ }).click();
  await expect(page.locator(".session")).toBeVisible();
  await answerRight(page, queue[queue.length - 1]!);
  await expectVerdict(page, "Correcte");
  // The second tap may land on the summary's own Continua (going home): either
  // way the session must be applied exactly once.
  await page.getByRole("button", { name: "Continua", exact: true }).dblclick();
  await expect(page.locator(".session")).toHaveCount(0);
  const expected = Object.fromEntries(queue.map((it) => [it.id, [1, 0]]));
  await expect.poll(() => statsOf(page)).toEqual(expected);
  await expect.poll(() => readStorage(page, DRAFT_KEY)).toBeNull();
  await page.reload();
  await expect.poll(() => statsOf(page)).toEqual(expected);
});

test("E2E-05 the back button exits sessions like the on-screen close", async ({ page }) => {
  await page.goto("/");
  // Empty session: back discards it, home shows no resume card.
  await startNext(page);
  await expect(page.locator(".session")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".home")).toBeVisible();
  await expect(resumeCard(page)).toHaveCount(0);

  // Partial session: back asks, cancel stays, confirm leaves a resumable draft.
  await startNext(page);
  const queue = lessonSession(units[0]!, 1).queue;
  await answerRight(page, queue[0]!);
  await expectVerdict(page, "Correcte");
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page.goBack();
  const dialog = page.getByRole("dialog", { name: "Surt de la sessió?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel·la", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".session")).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Surt", exact: true }).click();
  await expect(page.locator(".home")).toBeVisible();
  await expect(resumeCard(page)).toBeVisible();
});

test("E2E-06 a wrong answer opens theory that closes with Escape and restores focus", async ({ page }) => {
  const queue = lessonSession(units[0]!, 1).queue;
  const first = queue[0]!;
  if (first.type !== "choice") throw new Error("this test expects the first item to be a choice");
  await page.goto("/");
  await startNext(page);
  await page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(first.distractors[0]!.text))}$`) }).click();
  await expectVerdict(page, "Incorrecte");
  await page.getByRole("button", { name: "Per què?" }).click();
  const theoryButton = page.getByRole("button", { name: "Teoria", exact: true });
  await theoryButton.click();
  const dialog = page.getByRole("dialog", { name: "Teoria" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(theoryButton).toBeFocused();
});

test("E2E-07 the theme follows the system on Automatic and persists an override", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => themeOf(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => themeOf(page)).toBe("dark");
  await gotoSettings(page);
  await page.getByRole("radio", { name: "Fosc" }).click();
  await expect.poll(() => themeOf(page)).toBe("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => themeOf(page)).toBe("dark");
  await page.reload();
  await expect.poll(() => themeOf(page)).toBe("dark");
  await gotoSettings(page);
  await page.getByRole("radio", { name: "Clar" }).click();
  await expect.poll(() => themeOf(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => themeOf(page)).toBe("light");
  await page.reload();
  await expect.poll(() => themeOf(page)).toBe("light");
  await gotoSettings(page);
  await page.getByRole("radio", { name: "Automàtic" }).click();
  await expect.poll(() => themeOf(page)).toBe("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => themeOf(page)).toBe("light");
});

test("E2E-08 a reloaded session resumes, finishes and never applies twice", async ({ page }) => {
  const queue = lessonSession(units[0]!, 1).queue;
  await page.goto("/");
  await startNext(page);
  await answerRight(page, queue[0]!);
  await expectVerdict(page, "Correcte");
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await answerRight(page, queue[1]!);
  await expectVerdict(page, "Correcte");
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page.reload();
  const card = resumeCard(page);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: /Reprèn/ }).click();
  await expect(page.locator(".session")).toBeVisible();
  await playLesson(page, queue.slice(2));
  await expect(page.locator(".score")).toBeVisible();
  await expect.poll(() => readStorage(page, DRAFT_KEY)).toBeNull();
  const applied = await statsOf(page);
  expect(Object.keys(applied)).toHaveLength(queue.length);
  await page.reload();
  await expect.poll(() => statsOf(page)).toEqual(applied);
});

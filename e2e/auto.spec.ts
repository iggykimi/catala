// Auto-check and auto-advance (issue #4): default prefs, real motion. Unlike the other
// suites, NOTHING here pins autoAdvance off or reduces motion: these tests prove the
// production flow advances by itself after a clean correct answer, and waits otherwise.
import { expect, test } from "@playwright/test";
import { lessonSession } from "../src/app/session";
import { answerRight, escape, expectVerdict, plain, startNext, units } from "./helpers";

test("a correct answer advances without tapping Continua", async ({ page }) => {
  const queue = lessonSession(units[0]!, 1).queue;
  await page.goto("/");
  await startNext(page);
  await answerRight(page, queue[0]!);
  await expectVerdict(page, "Correcte");
  // No Continua while the transition runs, then the next exercise appears by itself.
  await expect(page.locator(".sheet-next")).toHaveCount(0);
  await expect(page.locator(".sheet")).toHaveCount(0);
  await expect(page.locator(".ex")).toBeVisible();
});

test("a wrong answer waits for Continua", async ({ page }) => {
  const queue = lessonSession(units[0]!, 1).queue;
  const first = queue[0]!;
  if (first.type !== "choice") throw new Error("this test expects the first item to be a choice");
  await page.goto("/");
  await startNext(page);
  await page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(first.distractors[0]!.text))}$`) }).click();
  await expectVerdict(page, "Incorrecte");
  await expect(page.locator(".sheet-next")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".sheet")).toBeVisible();
});

test("an accepted answer waits with its warning", async ({ page }) => {
  const unit = units.find((u) => u.id === "a2-03")!;
  const queue = lessonSession(unit, 5).queue;
  const target = queue.findIndex((it) => it.id === "a2-03-065");
  await page.goto("/");
  await page.locator(".unit-row", { hasText: plain(unit.title) }).click();
  await page.locator(".lesson-row").nth(4).click();
  for (const item of queue.slice(0, target)) {
    await answerRight(page, item);
    await expectVerdict(page, "Correcte");
    await expect(page.locator(".sheet")).toHaveCount(0);
  }
  await page.getByLabel("Resposta").fill("son");
  await page.getByRole("button", { name: "Comprova", exact: true }).click();
  await expectVerdict(page, "Correcte");
  await expect(page.locator(".solution")).toContainText("Compte amb l'accent: són");
  await expect(page.locator(".sheet-next")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".sheet")).toBeVisible();
});

test("disabling auto-advance makes correct answers wait", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ajustos" }).click();
  await page.getByRole("switch", { name: /Avanç automàtic/ }).click();
  await page.goBack();
  await page.locator(".home").waitFor();
  await startNext(page);
  await answerRight(page, lessonSession(units[0]!, 1).queue[0]!);
  await expectVerdict(page, "Correcte");
  await expect(page.locator(".sheet-next")).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator(".sheet")).toBeVisible();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("correct answers wait for Continua", async ({ page }) => {
    await page.goto("/");
    await startNext(page);
    await answerRight(page, lessonSession(units[0]!, 1).queue[0]!);
    await expectVerdict(page, "Correcte");
    await expect(page.locator(".sheet-next")).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.locator(".sheet")).toBeVisible();
  });
});

test("a full lesson completes hands-free with stats applied once", async ({ page }) => {
  const queue = lessonSession(units[0]!, 1).queue;
  await page.goto("/");
  await startNext(page);
  for (const item of queue) {
    await answerRight(page, item);
    await expectVerdict(page, "Correcte");
    await expect(page.locator(".sheet")).toHaveCount(0);
  }
  await expect(page.locator(".score")).toContainText(`${queue.length} de ${queue.length}`);
  const seen = await page.evaluate(
    (ids) => {
      const progress = JSON.parse(localStorage.getItem("catala.progress.v1")!);
      return ids.map((id: string) => progress.items[id]?.seen ?? 0);
    },
    queue.map((it) => it.id),
  );
  expect(new Set(seen)).toEqual(new Set([1]));
});

test("leaving before the transition cancels the advance", async ({ page }) => {
  const queue = lessonSession(units[0]!, 1).queue;
  await page.goto("/");
  await startNext(page);
  await answerRight(page, queue[0]!);
  await expectVerdict(page, "Correcte");
  await expect(page.locator(".sheet")).toHaveCount(0);
  await answerRight(page, queue[1]!);
  await expectVerdict(page, "Correcte");
  await page.getByRole("button", { name: "Surt" }).click();
  const dialog = page.getByRole("dialog", { name: "Surt de la sessió?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Surt", exact: true }).click();
  await page.locator(".home").waitFor();
  // Only the first item was applied; resuming shows the second one again.
  await expect(page.locator(".resume-card")).toContainText("1 de 13 exercicis");
  await page.locator(".resume-card").getByRole("button", { name: "Reprèn la lliçó" }).click();
  await expect(page.locator(".ex")).toBeVisible();
  await expect(page.locator(".sheet")).toHaveCount(0);
  await answerRight(page, queue[1]!);
  await expectVerdict(page, "Correcte");
  await expect(page.locator(".sheet")).toHaveCount(0);
});

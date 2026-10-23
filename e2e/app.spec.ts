import { expect, test } from "@playwright/test";
import type { Progress } from "../src/app/progress";
import { lessonSession, reviewSession } from "../src/app/session";
import { check, escape, expectVerdict, plain, playLesson, units } from "./helpers";

test("every lesson of every unit can be completed with the authored answers", async ({ page }) => {
  // About 13 items per lesson and 5 lessons per unit: the time grows with the course.
  test.setTimeout(90_000 * units.length);
  await page.goto("/");
  for (const unit of units) {
    for (let n = 1; n <= unit.lessons.length; n++) {
      await page.locator(".continue").click();
      await playLesson(page, lessonSession(unit, n).queue);
      await expect(page.locator(".score")).toContainText(`${lessonSession(unit, n).size} de ${lessonSession(unit, n).size}`);
      await page.getByRole("button", { name: "Continua" }).click();
    }
  }
  // Everything done: no lesson left to continue.
  await expect(page.locator(".continue")).toHaveCount(0);
});

test("a wrong answer is explained, comes back at the end and counts as a miss", async ({ page }) => {
  const unit = units[0]!;
  const [first, ...rest] = lessonSession(unit, 1).queue;
  await page.goto("/");
  await page.locator(".continue").click();

  if (first!.type !== "choice") throw new Error("this test expects the first item to be a choice");
  await page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(first!.distractors[0]!.text))}$`) }).click();
  await check(page);
  await expectVerdict(page, "Incorrecte");
  await expect(page.locator(".option.is-right")).toHaveText(plain(first!.answer));
  await page.getByRole("button", { name: "Teoria" }).click();
  await expect(page.getByRole("dialog", { name: "Teoria" })).toBeVisible();
  await page.getByRole("button", { name: "Tanca" }).click();
  await page.getByRole("button", { name: "Continua" }).click();

  await playLesson(page, [...rest, first!]);
  const size = rest.length + 1;
  await expect(page.locator(".score")).toContainText(`${size - 1} de ${size}`);
});

test("progress survives a reload and due points come back as a review", async ({ page }) => {
  const day0 = new Date("2026-10-20T09:00:00");
  await page.clock.install({ time: day0 });
  await page.goto("/");
  const unit = units[0]!;
  await page.locator(".continue").click();
  await playLesson(page, lessonSession(unit, 1).queue);
  await page.getByRole("button", { name: "Continua" }).click();

  await page.reload();
  await expect(page.locator(".unit-row").first().locator(".panot-part.is-filled")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Repàs/ })).toHaveCount(0);

  const later = new Date("2026-11-20T09:00:00");
  await page.clock.setFixedTime(later);
  await page.reload();
  const stored = await page.evaluate(() => localStorage.getItem("catala.progress.v1"));
  const review = reviewSession(units, JSON.parse(stored!) as Progress, later);
  expect(review.size).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Repàs/ }).click();
  await playLesson(page, review.queue);
  await expect(page.locator("h1")).toHaveText("Repàs fet");
});

test("a typed answer with a missing accent passes with a warning", async ({ page }) => {
  const unit = units.find((u) => u.id === "a2-03")!;
  const queue = lessonSession(unit, 5).queue;
  const target = queue.findIndex((it) => it.id === "a2-03-065");
  await page.goto("/");
  await page.locator(".unit-row", { hasText: plain(unit.title) }).click();
  await page.locator(".lesson-row").nth(4).click();
  await playLesson(page, queue.slice(0, target));
  await page.getByLabel("Resposta").fill("son");
  await check(page);
  await expectVerdict(page, "Correcte");
  await expect(page.locator(".solution")).toContainText("Compte amb l'accent: són");
});

test("the back button and settings work", async ({ page }) => {
  await page.goto("/");
  await page.locator(".unit-row").first().click();
  await page.getByRole("button", { name: "Teoria" }).click();
  await expect(page.locator(".prose h2").first()).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page.locator(".continue")).toBeVisible();

  await page.getByRole("button", { name: "Ajustos" }).click();
  await page.getByLabel("Còpia del progrés").fill("no és res");
  await page.getByRole("button", { name: "Restaura" }).click();
  await expect(page.locator(".error")).toBeVisible();
});

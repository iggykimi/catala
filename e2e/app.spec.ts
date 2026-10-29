import { expect, test } from "@playwright/test";
import type { Progress } from "../src/app/progress";
import { lessonSession, reviewSession } from "../src/app/session";
import { answerRight, check, escape, expectVerdict, openIntro, openUnitLesson, plain, playLesson, resumeCard, startNext, units } from "./helpers";

// Reduced motion turns off the entrance animations and the confetti (styles.css, fx.ts),
// so Playwright does not wait out an animation on every one of the ~3,900 items.
test.use({ reducedMotion: "reduce" });

// One test per unit, not one for the whole course: fullyParallel can only split tests,
// and a single sequential test kept one worker busy while the rest idled.
for (const unit of units) {
  test(`every lesson of ${unit.id} can be completed with the authored answers`, async ({ page }) => {
    // ~65 items, sharing the CPU with the other workers: leave ample room.
    test.setTimeout(300_000);
    await page.goto("/");
    for (let n = 1; n <= unit.lessons.length; n++) {
      await openUnitLesson(page, unit, n);
      await playLesson(page, lessonSession(unit, n).queue);
      await expect(page.locator(".score")).toContainText(`${lessonSession(unit, n).size} de ${lessonSession(unit, n).size}`);
      await page.getByRole("button", { name: "Continua", exact: true }).click();
    }
  });
}

test("a finished course offers no next lesson", async ({ page }) => {
  const lessons = Object.fromEntries(
    units.flatMap((u) => u.lessons.map((_, i) => [`${u.id}#${i + 1}`, "2026-10-20T09:00:00.000Z"])),
  );
  await page.addInitScript((done) => {
    localStorage.setItem(
      "catala.progress.v1",
      JSON.stringify({ v: 1, lessons: done, cards: {}, items: {}, days: [], flagged: [] }),
    );
  }, lessons);
  await page.goto("/");
  await expect(page.locator(".continue")).toHaveCount(0);
  await expect(page.locator(".hero-title")).toHaveText("Has acabat el curs");
});

test("a wrong answer is explained, comes back at the end and counts as a miss", async ({ page }) => {
  const unit = units[0]!;
  const [first, ...rest] = lessonSession(unit, 1).queue;
  await page.goto("/");
  await startNext(page);

  if (first!.type !== "choice") throw new Error("this test expects the first item to be a choice");
  await page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(first!.distractors[0]!.text))}$`) }).click();
  await check(page);
  await expectVerdict(page, "Incorrecte");
  await expect(page.locator(".option.is-right")).toHaveText(plain(first!.answer));
  await page.getByRole("button", { name: "Per què?" }).click();
  await page.getByRole("button", { name: "Teoria" }).click();
  await expect(page.getByRole("dialog", { name: "Teoria" })).toBeVisible();
  await page.getByRole("button", { name: "Tanca" }).click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();

  await playLesson(page, [...rest, first!]);
  const size = rest.length + 1;
  await expect(page.locator(".score")).toContainText(`${size - 1} de ${size}`);
});

test("progress survives a reload and due points come back as a review", async ({ page }) => {
  const day0 = new Date("2026-10-20T09:00:00");
  await page.clock.install({ time: day0 });
  await page.goto("/");
  const unit = units[0]!;
  await startNext(page);
  await playLesson(page, lessonSession(unit, 1).queue);
  await page.getByRole("button", { name: "Continua", exact: true }).click();

  await page.reload();
  await expect(page.locator(".unit-row").first().locator(".panot-part.is-filled")).toHaveCount(1);
  await expect(page.locator(".review")).toHaveCount(0);

  const later = new Date("2026-11-20T09:00:00");
  await page.clock.setFixedTime(later);
  await page.reload();
  const stored = await page.evaluate(() => localStorage.getItem("catala.progress.v1"));
  const review = reviewSession(units, JSON.parse(stored!) as Progress, later);
  expect(review.size).toBeGreaterThan(0);
  await page.locator(".review").click();
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

test("home keeps the main action visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".continue")).toBeInViewport();
});

test("restores home scroll after visiting a unit", async ({ page }) => {
  await page.goto("/");
  const lastUnit = page.locator(".unit-row").last();
  await lastUnit.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await lastUnit.click();
  await page.goBack();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 30);
});

test("intro cards go back", async ({ page }) => {
  const unit = units.find((u) => u.id === "a2-01")!;
  await page.goto("/");
  await openIntro(page, unit);
  const back = page.getByRole("button", { name: "Anterior", exact: true });
  const next = page.getByRole("button", { name: "Següent", exact: true });
  await expect(back).toHaveCount(0);
  await next.click();
  await expect(back).toBeVisible();
  await back.click();
  await expect(back).toHaveCount(0);
  await expect(next).toBeVisible();
});

test("back from settings returns home", async ({ page }) => {
  await page.goto("/");
  const lastUnit = page.locator(".unit-row").last();
  await lastUnit.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "Ajustos" }).click();
  await expect(page.locator(".topbar-title")).toHaveText("Ajustos");
  await page.goBack();
  await expect(page.locator(".home")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 30);
});

test("back from theory returns to the unit", async ({ page }) => {
  await page.goto("/");
  await page.locator(".unit-row").first().click();
  await page.getByRole("button", { name: "Teoria" }).click();
  await expect(page.locator(".prose h2").first()).toBeVisible();
  await page.getByRole("button", { name: "Enrere" }).click();
  await expect(page.locator(".lesson-row").first()).toBeVisible();
});

/** A mid-lesson draft of a2-01 lesson 1: 3 items left out of the full lesson. */
function seedDraftData() {
  const unit = units.find((u) => u.id === "a2-01")!;
  const ids = lessonSession(unit, 1).queue.map((it) => it.id);
  return {
    v: 1,
    id: "test",
    savedAt: new Date().toISOString(),
    kind: "lesson",
    unitId: "a2-01",
    lesson: 1,
    queueIds: ids.slice(0, 3),
    size: ids.length,
    // The rest was already worked: loadDraft only restores a draft whose known ids cover the session.
    firstTry: Object.fromEntries(ids.slice(3).map((id) => [id, "correct"])),
  };
}

test("a saved draft offers to resume the lesson", async ({ page }) => {
  const unit = units.find((u) => u.id === "a2-01")!;
  const queue = lessonSession(unit, 1).queue;
  await page.addInitScript((draft) => {
    localStorage.setItem("catala.session.v1", JSON.stringify(draft));
  }, seedDraftData());
  await page.goto("/");
  const card = resumeCard(page);
  await expect(card).toBeVisible();
  await expect(card).toContainText(plain(unit.title));
  await card.getByRole("button", { name: /Reprèn/ }).click();
  await expect(page.locator(".screen.session")).toBeVisible();
  await answerRight(page, queue[0]!);
  await expectVerdict(page, "Correcte");
});

test("discarding a saved draft clears it", async ({ page }) => {
  await page.addInitScript((draft) => {
    localStorage.setItem("catala.session.v1", JSON.stringify(draft));
  }, seedDraftData());
  await page.goto("/");
  const card = resumeCard(page);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Descarta-la", exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("catala.session.v1"))).toBeNull();
});

// Screenshots for visual review, not assertions. Run with:
//   SCREENS=<output dir> npx playwright test screens
import { test, type Page } from "@playwright/test";
import type { Item } from "../src/content/schema";
import { lessonSession } from "../src/app/session";
import { answerRight, check, playLesson, units } from "./helpers";

const out = process.env.SCREENS;
test.skip(!out, "set SCREENS=<dir> to take screenshots");

/** Waits for entrance animations (sheet, tile) to end before the picture. */
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/${name}.png`, scale: "css" });
};

/** Plays lesson items until `id` is current; returns that item. */
async function reach(page: Page, queue: Item[], id: string) {
  const i = queue.findIndex((it) => it.id === id);
  await playLesson(page, queue.slice(0, i));
  return queue[i]!;
}

for (const scheme of ["light", "dark"] as const) {
  test(`screens ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const unit = units.find((u) => u.id === "a2-03")!;
    await page.goto("/");
    await shot(page, `${scheme}-01-home-empty`);

    // Lesson 1: choice (answering and wrong), inline-choice, match, summary.
    await page.locator(".continue").click();
    const l1 = lessonSession(unit, 1).queue;
    await page.locator(".option").first().click();
    await shot(page, `${scheme}-02-choice`);
    await page.locator(".option").filter({ hasNotText: (l1[0] as Extract<Item, { type: "choice" }>).answer }).first().click();
    await check(page);
    await shot(page, `${scheme}-03-feedback-wrong`);
    await page.getByRole("button", { name: "Teoria" }).click();
    await shot(page, `${scheme}-04-theory-overlay`);
    await page.getByRole("button", { name: "Tanca" }).click();
    await page.getByRole("button", { name: "Continua" }).click();
    const inline = await reach(page, l1.slice(1), "a2-03-009");
    await page.getByRole("button", { name: "Buit 1", exact: true }).click();
    await shot(page, `${scheme}-05-inline-choice`);
    await answerRight(page, inline);
    await shot(page, `${scheme}-06-feedback-right`);
    await page.getByRole("button", { name: "Continua" }).click();
    await reach(page, l1.slice(l1.findIndex((it) => it.id === "a2-03-010")), "a2-03-011");
    await shot(page, `${scheme}-07-match`);
    await playLesson(page, l1.slice(l1.findIndex((it) => it.id === "a2-03-011")));
    await playLesson(page, [l1[0]!]);
    await shot(page, `${scheme}-08-summary`);
    await page.getByRole("button", { name: "Continua" }).click();
    await shot(page, `${scheme}-09-home-progress`);

    // Lesson 2: fill and order.
    await page.locator(".continue").click();
    const l2 = lessonSession(unit, 2).queue;
    await page.getByLabel("Resposta").fill("compro");
    await shot(page, `${scheme}-10-fill`);
    await check(page);
    await page.getByRole("button", { name: "Continua" }).click();
    await reach(page, l2.slice(1), "a2-03-020");
    await page.locator(".bank .chip").first().click();
    await shot(page, `${scheme}-11-order`);
    await page.goBack();

    // Unit, theory, vocabulary.
    await page.locator(".unit-row").first().click();
    await shot(page, `${scheme}-12-unit`);
    await page.getByRole("button", { name: "Teoria" }).click();
    await shot(page, `${scheme}-13-theory`);
    await page.goBack();
    await page.getByRole("button", { name: "Vocabulari" }).click();
    await shot(page, `${scheme}-14-vocab`);
    await page.goBack();

    // Lesson 3: find-error (both stages). Lesson 4: transform. Lesson 5: reading.
    await page.locator(".lesson-row").nth(2).click();
    const l3 = lessonSession(unit, 3).queue;
    await reach(page, l3, "a2-03-035");
    await page.locator(".token").nth(2).click();
    await shot(page, `${scheme}-15-find-error`);
    await check(page);
    await shot(page, `${scheme}-16-find-error-fix`);
    await page.goBack();
    await page.locator(".lesson-row").nth(3).click();
    await page.getByLabel("Resposta").fill("Nosaltres sopem a casa dels avis cada diumenge");
    await shot(page, `${scheme}-17-transform`);
    await page.goBack();
    await page.locator(".lesson-row").nth(4).click();
    await shot(page, `${scheme}-18-reading`);
  });
}

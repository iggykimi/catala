// Screenshots for visual review, not assertions. Run with:
//   SCREENS=<output dir> npx playwright test screens
import { expect, test, type Page } from "@playwright/test";
import type { Item } from "../src/content/schema";
import { lessonSession } from "../src/app/session";
import { answerRight, check, escape, expectVerdict, playLesson, plain, seedPrefs, skipIntro, units } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedPrefs(page, { sound: true, vibration: true, theme: "system", autoAdvance: false });
});

/** Renders text without diacritics, e.g. an accent slip a tolerant grader accepts. */
const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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

const next = (page: Page) => page.getByRole("button", { name: "Continua", exact: true }).click();

/** Discards the home resume card through the UI when one is shown. */
async function discardResumeCard(page: Page) {
  const card = page.locator(".resume-card");
  // Home re-reads storage on arrival: give the card a moment before concluding there is none.
  await card.waitFor({ timeout: 2000 }).catch(() => {});
  if (!(await card.isVisible())) return;
  await card.getByRole("button", { name: /Descarta/ }).click();
  // A draft with answers asks for confirmation; an empty one goes at once.
  const discard = page.getByRole("dialog", { name: "Descarta la sessió?" });
  await discard.waitFor({ timeout: 2000 }).catch(() => {});
  if (await discard.isVisible()) {
    await discard.getByRole("button", { name: "Descarta", exact: true }).click();
  }
  await expect(card).toHaveCount(0);
}

/**
 * Closes the current session through the UI (Surt, confirming when partial),
 * discards its draft from home, and reopens the unit: refuse-to-overwrite
 * means the next lesson needs a clean state first.
 */
async function abandonToUnit(page: Page, unitTitle: string) {
  await page.getByRole("button", { name: "Surt" }).click();
  const exitDialog = page.getByRole("dialog", { name: "Surt de la sessió?" });
  await exitDialog.waitFor({ timeout: 2000 }).catch(() => {});
  if (await exitDialog.isVisible()) {
    await exitDialog.getByRole("button", { name: "Surt", exact: true }).click();
  }
  await page.locator(".lesson-row").first().waitFor();
  await page.goBack();
  await page.locator(".home").waitFor();
  await discardResumeCard(page);
  await page.locator(".unit-row", { hasText: plain(unitTitle) }).click();
  await page.locator(".lesson-row").first().waitFor();
}

/** A mid-lesson draft of a2-01 lesson 1: 3 items left out of the full lesson. */
const resumeUnit = units.find((u) => u.id === "a2-01")!;
const resumeIds = lessonSession(resumeUnit, 1).queue.map((it) => it.id);
const resumeDraft = {
  v: 1,
  id: "shots",
  savedAt: new Date().toISOString(),
  kind: "lesson",
  unitId: "a2-01",
  lesson: 1,
  queueIds: resumeIds.slice(0, 3),
  size: resumeIds.length,
  firstTry: Object.fromEntries(resumeIds.slice(3).map((id) => [id, "correct"])),
};

for (const scheme of ["light", "dark"] as const) {
  test(`screens ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const unit = units.find((u) => u.id === "a2-03")!;
    await page.goto("/");
    await shot(page, `${scheme}-01-home`);

    // Save failure: with storage writes blocked, the session warns it cannot resume.
    await page.evaluate(() => {
      const proto = Object.getPrototypeOf(localStorage);
      (window as unknown as Record<string, unknown>).__origSetItem = proto.setItem;
      proto.setItem = () => {
        throw new Error("storage blocked for a screenshot");
      };
    });
    await page.locator(".continue").click();
    await skipIntro(page);
    await page.locator(".save-error").waitFor();
    await shot(page, `${scheme}-31-save-error`);
    await page.getByRole("button", { name: "Surt" }).click();
    await page.evaluate(() => {
      const proto = Object.getPrototypeOf(localStorage);
      proto.setItem = (window as unknown as Record<string, unknown>).__origSetItem;
    });
    await page.locator(".home").waitFor();

    // Unit, theory, vocabulary.
    await page.locator(".unit-row", { hasText: plain(unit.title) }).click();
    await shot(page, `${scheme}-02-unit`);
    await page.getByRole("button", { name: "Teoria" }).click();
    await shot(page, `${scheme}-03-theory`);
    // Wide table: the conjugation table is the page's widest.
    await page.evaluate(() => {
      const tables = [...document.querySelectorAll(".theory-card table")];
      tables.sort((a, b) => b.scrollWidth - a.scrollWidth);
      tables[0]?.scrollIntoView({ block: "center" });
    });
    await shot(page, `${scheme}-21-theory-table`);
    await page.goBack();
    await page.getByRole("button", { name: "Vocabulari" }).click();
    await shot(page, `${scheme}-04-vocab`);
    await page.goBack();

    // Lesson 1: theory cards, choice (wrong), inline-choice (right), match, summary.
    await page.locator(".lesson-row").first().click();
    await shot(page, `${scheme}-05-intro`);
    while (await page.getByRole("button", { name: "Següent", exact: true }).isVisible()) {
      await page.getByRole("button", { name: "Següent", exact: true }).click();
    }
    await page.getByRole("button", { name: "Comença", exact: true }).click();
    const l1 = lessonSession(unit, 1).queue;
    await shot(page, `${scheme}-06-choice`);
    await page.locator(".option").filter({ hasNotText: (l1[0] as Extract<Item, { type: "choice" }>).answer }).first().click();
    await expectVerdict(page, "Incorrecte");
    await shot(page, `${scheme}-07-feedback-wrong`);
    await page.getByRole("button", { name: "Per què?" }).click();
    await shot(page, `${scheme}-08-feedback-why`);
    await page.getByRole("button", { name: "Teoria" }).click();
    await shot(page, `${scheme}-09-theory-modal`);
    await page.getByRole("button", { name: "Tanca" }).click();
    await next(page);
    const inline = await reach(page, l1.slice(1), "a2-03-009");
    await page.getByRole("button", { name: "Buit 1", exact: true }).click();
    await shot(page, `${scheme}-10-inline-choice`);
    await answerRight(page, inline);
    await shot(page, `${scheme}-11-feedback-right`);
    await next(page);
    // Leaving a partial session asks for confirmation; cancel and carry on.
    await page.getByRole("button", { name: "Surt" }).click();
    const exitDialog = page.getByRole("dialog", { name: "Surt de la sessió?" });
    await exitDialog.waitFor();
    await shot(page, `${scheme}-30-exit-dialog`);
    await exitDialog.getByRole("button", { name: "Cancel·la" }).click();
    await reach(page, l1.slice(l1.findIndex((it) => it.id === "a2-03-010")), "a2-03-011");
    await shot(page, `${scheme}-12-match`);
    // Match with a previous error: one wrong pair, then all pairs right.
    const matchIdx = l1.findIndex((it) => it.id === "a2-03-011");
    const match = l1[matchIdx] as Extract<Item, { type: "match" }>;
    await page.locator(".match-col").first().getByRole("button", { name: plain(match.pairs[0]![0]), exact: true }).click();
    await page.locator(".match-col").last().getByRole("button", { name: plain(match.pairs[1]![1]), exact: true }).click();
    await page.waitForTimeout(600);
    for (const [l, r] of match.pairs) {
      await page.locator(".match-col").first().getByRole("button", { name: plain(l), exact: true }).click();
      await page.locator(".match-col").last().getByRole("button", { name: plain(r), exact: true }).click();
    }
    await expectVerdict(page, "Incorrecte");
    await shot(page, `${scheme}-22-match-errors`);
    await next(page);
    await playLesson(page, l1.slice(matchIdx + 1));
    await playLesson(page, [l1[0]!, match]);
    await shot(page, `${scheme}-13-summary`);
    await next(page);
    await shot(page, `${scheme}-14-home-progress`);
    await page.locator(".level-B1 .level-name").scrollIntoViewIfNeeded();
    await shot(page, `${scheme}-25-home-b1`);
    await page.locator(".level-B2 .level-name").scrollIntoViewIfNeeded();
    await shot(page, `${scheme}-26-home-b2`);

    // Lesson 2: fill and order. Lesson 3: find-error. Lesson 4: transform. Lesson 5: reading.
    await page.locator(".unit-row", { hasText: plain(unit.title) }).click();
    await page.locator(".lesson-row").nth(1).click();
    const l2 = lessonSession(unit, 2).queue;
    await page.getByLabel("Resposta").fill("compro");
    await shot(page, `${scheme}-15-fill`);
    await check(page);
    await next(page);
    await reach(page, l2.slice(1), "a2-03-020");
    await page.locator(".bank .chip").first().click();
    await shot(page, `${scheme}-16-order`);
    await abandonToUnit(page, unit.title);
    await page.locator(".lesson-row").nth(2).click();
    await reach(page, lessonSession(unit, 3).queue, "a2-03-035");
    await page.locator(".token").nth(2).click();
    await shot(page, `${scheme}-17-find-error`);
    await abandonToUnit(page, unit.title);
    await page.locator(".lesson-row").nth(3).click();
    await page.getByLabel("Resposta").fill("Nosaltres sopem a casa dels avis cada diumenge");
    await shot(page, `${scheme}-18-transform`);
    await abandonToUnit(page, unit.title);
    await page.locator(".lesson-row").nth(4).click();
    await shot(page, `${scheme}-19-reading`);
    // Reading with errors: first question wrong, the rest right.
    const l5 = lessonSession(unit, 5).queue;
    const reading = l5[0] as Extract<Item, { type: "reading" }>;
    await page.locator(".question").nth(0).locator(".option").filter({ hasNotText: plain(reading.questions[0]!.answer) }).first().click();
    for (const [qi, q] of reading.questions.slice(1).entries()) {
      await page.locator(".question").nth(qi + 1).locator(".option").filter({ hasText: new RegExp(`^${escape(plain(q.answer))}$`) }).click();
    }
    await expectVerdict(page, "Incorrecte");
    await shot(page, `${scheme}-23-reading-errors`);
    await next(page);
    // Accepted answer: "són" typed without the accent passes with a warning.
    const fill = await reach(page, l5.slice(1), "a2-03-065");
    await page.getByLabel("Resposta").fill(stripAccents((fill as Extract<Item, { type: "fill" }>).answers[0]!));
    await check(page);
    await shot(page, `${scheme}-24-accepted`);
    await next(page);
    // Close the partial session through the UI, then go home and open settings.
    await page.getByRole("button", { name: "Surt" }).click();
    const exitDialog2 = page.getByRole("dialog", { name: "Surt de la sessió?" });
    await exitDialog2.waitFor();
    await exitDialog2.getByRole("button", { name: "Surt", exact: true }).click();
    await page.locator(".lesson-row").first().waitFor();
    await page.goBack();
    await page.locator(".home").waitFor();
    await page.getByRole("button", { name: "Ajustos" }).click();
    await shot(page, `${scheme}-20-settings`);
    await page.locator(".theme-group").scrollIntoViewIfNeeded();
    await shot(page, `${scheme}-33-theme`);
    // Restore dialog (cancelled: the progress stays untouched).
    const backup = JSON.stringify({ v: 1, lessons: {}, cards: {}, items: {}, days: [], flagged: [] });
    await page.getByLabel("Còpia del progrés").fill(backup);
    await page.getByRole("button", { name: "Restaura", exact: true }).click();
    const restoreDialog = page.getByRole("dialog", { name: "Restaura el progrés?" });
    await restoreDialog.waitFor();
    await shot(page, `${scheme}-32-restore-dialog`);
    await restoreDialog.getByRole("button", { name: "Cancel·la" }).click();
    await page.getByRole("button", { name: "Esborra el progrés" }).click();
    await page.locator(".confirm-dialog").waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
    await shot(page, `${scheme}-27-dialog`);
    const cancel = page.locator(".confirm-dialog").getByRole("button", { name: "Cancel·la" });
    if (await cancel.count()) await cancel.click();
    // The abandoned lesson-5 session is pending: discard it through the UI.
    await page.goBack();
    await page.locator(".resume-card").waitFor();
    await page.locator(".resume-card").getByRole("button", { name: /Descarta/ }).click();
    const discardDialog = page.getByRole("dialog", { name: "Descarta la sessió?" });
    await discardDialog.waitFor();
    await shot(page, `${scheme}-34-discard-dialog`);
    await discardDialog.getByRole("button", { name: "Descarta", exact: true }).click();
    await expect(page.locator(".resume-card")).toHaveCount(0);
    // Completed course: seed every lesson done, then reload home.
    const flaggedSample = unit.items.slice(0, 2).map((it) => it.id);
    await page.evaluate(
      ({ all, flagged }) => {
        const stamp = new Date().toISOString();
        const lessons: Record<string, string> = {};
        for (const u of all as { id: string; count: number }[]) {
          for (let n = 1; n <= u.count; n++) lessons[`${u.id}#${n}`] = stamp;
        }
        const now = new Date();
        const p = (n: number) => String(n).padStart(2, "0");
        const day = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
        localStorage.setItem(
          "catala.progress.v1",
          JSON.stringify({ v: 1, lessons, cards: {}, items: {}, days: [day], flagged }),
        );
      },
      { all: units.map((u) => ({ id: u.id, count: u.lessons.length })), flagged: flaggedSample },
    );
    await page.goto("/");
    await shot(page, `${scheme}-28-home-done`);
    // Resumable session: a mid-lesson draft offers to resume from home.
    await page.evaluate((draft) => {
      localStorage.setItem("catala.session.v1", JSON.stringify(draft));
    }, resumeDraft);
    await page.goto("/");
    await page.locator(".resume-card").waitFor();
    await shot(page, `${scheme}-29-resume`);
    // Flagged exercises in settings.
    await page.getByRole("button", { name: "Ajustos" }).click();
    await page.locator(".flagged-list").scrollIntoViewIfNeeded();
    await shot(page, `${scheme}-35-flagged`);
  });
}

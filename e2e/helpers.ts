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
      await page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(item.answer))}$`) }).click();
      return check(page);
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
      return check(page);
    }
    case "find-error": {
      if (item.no_error) {
        await button(page, "No hi ha cap error").click();
        return check(page);
      }
      const start = item.sentence.indexOf(item.error!);
      const tokenIndex = [...item.sentence.matchAll(/\S+/g)].findIndex((m) => m.index + m[0].length > start);
      await page.locator(".token").nth(tokenIndex).click();
      await check(page);
      await page.locator(".option").filter({ hasText: new RegExp(`^${escape(plain(item.fix!))}$`) }).click();
      return check(page);
    }
    case "order":
      for (const c of item.chunks) await page.locator(".bank").getByRole("button", { name: c, exact: true }).first().click();
      return check(page);
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
      return check(page);
  }
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

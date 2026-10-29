import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * PWA prompt-mode update flow (issue #2, P0.3).
 *
 * Builds the app once into test-results/, derives a "version B" by patching the
 * built index.html (plus its precache revision in sw.js), then serves A and B in
 * turn on one origin: install SW on A, start a session, revisit on B and assert
 * no auto-reload + an update bar on home, tap Actualitza, assert version B with
 * progress and draft intact. Never touches the shared dist/ directory.
 */
test.use({
  baseURL: "http://localhost:4186",
  // Full Chromium in new headless mode: service workers are unreliable in headless shell.
  launchOptions: { channel: "chromium" },
});

test.setTimeout(90_000);

const PORT = 4186;
const ROOT = process.cwd();
const FIXTURE = `${ROOT}/test-results/pwa-update`;
const BUILD_A = `${FIXTURE}/buildA`;
const BUILD_B = `${FIXTURE}/buildB`;
const MARKER = '<meta name="pwa-version" content="B" />';

const loadsOf = (page: Page) => page.evaluate(() => sessionStorage.getItem("__loads"));
const versionOf = (page: Page) =>
  page.evaluate(() => document.querySelector('meta[name="pwa-version"]')?.getAttribute("content") ?? "A");
const snapshotLS = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === null || k.startsWith("__")) continue;
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
const swState = (page: Page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { controller: !!navigator.serviceWorker.controller, waiting: !!reg?.waiting };
  });

function viteBuild(outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["node_modules/vite/bin/vite.js", "build", "--outDir", outDir],
      { cwd: ROOT, timeout: 120_000 },
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

/** Derive version B from a copy of A: patched index.html + matching precache revision. */
function deriveBuildB() {
  rmSync(BUILD_B, { recursive: true, force: true });
  mkdirSync(FIXTURE, { recursive: true });
  cpSync(BUILD_A, BUILD_B, { recursive: true });
  const htmlPath = `${BUILD_B}/index.html`;
  const html = readFileSync(htmlPath, "utf8");
  if (!html.includes("</head>")) throw new Error("built index.html has no </head>");
  const patched = html.replace("</head>", `  ${MARKER}\n  </head>`);
  writeFileSync(htmlPath, patched);
  const revision = createHash("md5").update(patched).digest("hex");
  const swPath = `${BUILD_B}/sw.js`;
  const sw = readFileSync(swPath, "utf8");
  const next = sw.replace(/(\{url:"index\.html",revision:")[0-9a-f]{32}("})/, `$1${revision}$2`);
  if (next === sw) throw new Error("index.html precache entry not found in built sw.js");
  writeFileSync(swPath, next);
}

function serve(dir: string): ChildProcess {
  return spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "preview", "--outDir", dir, "--port", String(PORT), "--strictPort"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
}

async function waitForServer(child: ChildProcess) {
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    if (child.exitCode !== null) throw new Error(`preview server exited early (code ${child.exitCode})`);
    try {
      const r = await fetch(`http://localhost:${PORT}/`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("preview server did not come up in 30s");
}

async function stop(child: ChildProcess | null) {
  if (!child || child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.on("exit", () => resolve());
    child.kill();
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      resolve();
    }, 5000);
  });
}

/** Home -> first lesson of the next unit, paging through the theory intro. */
async function startSession(page: Page) {
  await page.locator(".continue").click();
  await page.locator(".intro, .session").first().waitFor({ timeout: 15_000 });
  for (let i = 0; i < 12; i++) {
    if (await page.locator(".session").isVisible()) return;
    const seguent = page.getByRole("button", { name: "Següent", exact: true });
    if (await seguent.isVisible()) {
      await seguent.click();
      continue;
    }
    const comenca = page.getByRole("button", { name: "Comença", exact: true });
    if (await comenca.isVisible()) {
      await comenca.click();
      return;
    }
  }
  await page.locator(".session").waitFor({ timeout: 15_000 });
}

test("PWA update waits for an explicit tap, then preserves progress", async ({ page }) => {
  let server: ChildProcess | null = null;
  try {
    await test.step("build A and derive B", async () => {
      await viteBuild(BUILD_A);
      deriveBuildB();
    });

    server = serve(BUILD_A);
    await waitForServer(server);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      sessionStorage.setItem("__loads", String(Number(sessionStorage.getItem("__loads") ?? 0) + 1));
      if (!localStorage.getItem("catala.progress.v1")) {
        localStorage.setItem(
          "catala.progress.v1",
          JSON.stringify({ v: 1, lessons: {}, cards: {}, items: {}, days: ["2026-10-29"], flagged: [] }),
        );
      }
    });

    await test.step("install SW and start a session", async () => {
      await page.goto("/");
      await page.locator(".continue").waitFor({ timeout: 30_000 });
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.locator(".continue").waitFor({ timeout: 30_000 });
      expect(await swState(page)).toEqual({ controller: true, waiting: false });
      expect(await versionOf(page)).toBe("A");

      await startSession(page);
      await expect(page.locator(".session")).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("catala.session.v1"))).not.toBeNull();
      await expect(page.locator(".update-bar")).toBeHidden();
    });

    const snap0 = await snapshotLS(page);
    const loads0 = Number(await loadsOf(page));

    await test.step("revisit on B: no auto-reload, bar on home", async () => {
      await stop(server);
      server = serve(BUILD_B);
      await waitForServer(server);

      await page.reload();
      // A draft is pending, so home shows the resume hero instead of Continua.
      await page.locator(".resume-card").waitFor({ timeout: 30_000 });
      expect(Number(await loadsOf(page))).toBe(loads0 + 1);

      try {
        await page.locator(".update-bar").waitFor({ timeout: 20_000 });
      } catch {
        // Nudge the update check the way a revisit does, then wait again.
        await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
        await page.locator(".update-bar").waitFor({ timeout: 20_000 });
      }
      await expect(page.locator(".update-bar")).toContainText("Hi ha una nova versió disponible.");
      await expect(page.getByRole("button", { name: "Actualitza", exact: true })).toBeVisible();

      await page.waitForTimeout(3000);
      expect(Number(await loadsOf(page))).toBe(loads0 + 1);
      expect(await versionOf(page)).toBe("A");
      expect(await swState(page)).toEqual({ controller: true, waiting: true });
    });

    await test.step("tap Actualitza: new version, state intact", async () => {
      await page.getByRole("button", { name: "Actualitza", exact: true }).click();
      await page.waitForFunction((prev) => Number(sessionStorage.getItem("__loads") ?? 0) > prev, loads0 + 1, {
        timeout: 20_000,
      });
      // The pending draft survives the update: home still shows the resume hero.
      await page.locator(".resume-card").waitFor({ timeout: 30_000 });
      expect(Number(await loadsOf(page))).toBe(loads0 + 2);
      expect(await versionOf(page)).toBe("B");
      expect(await snapshotLS(page)).toEqual(snap0);
      await expect(page.locator(".resume-card")).toBeVisible();
      await expect(page.locator(".update-bar")).toBeHidden();
      expect(await swState(page)).toEqual({ controller: true, waiting: false });
    });

    expect(errors).toEqual([]);
  } finally {
    await stop(server);
  }
});

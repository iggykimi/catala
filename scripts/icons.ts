// Renders the app icons from the dragon illustration. Run after changing the artwork.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const drac = `data:image/png;base64,${readFileSync("src/app/assets/drac.png").toString("base64")}`;
// `inset` is the share of the square the dragon takes: maskable icons must keep it in the central safe zone.
const icon = (size: number, radius: string, inset: number) => `
  <style>*{margin:0}body{width:${size}px;height:${size}px}</style>
  <div style="width:${size}px;height:${size}px;border-radius:${radius};background:#ffc93c;display:grid;place-items:center">
    <img src="${drac}" style="width:${inset * 100}%;height:${inset * 100}%;filter:drop-shadow(0 ${size / 40}px 0 rgba(0,0,0,.18))">
  </div>`;

const browser = await chromium.launch();
const shots: [string, number, string, number][] = [
  ["public/icon-192.png", 192, "22%", 0.78],
  ["public/icon-512.png", 512, "22%", 0.78],
  ["public/icon-maskable-512.png", 512, "0", 0.62],
];
for (const [path, size, radius, inset] of shots) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(icon(size, radius, inset));
  await page.screenshot({ path, omitBackground: true });
}
await browser.close();

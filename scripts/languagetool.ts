// Checks every correct-Catalan text of the given units against a LanguageTool server.
// Start one with:  docker run -d --name languagetool -p 8010:8010 erikvl87/languagetool
// Usage: npm run languagetool -- <unit dir or folder of unit dirs> ...
// Findings are leads for a human reviewer, not verdicts: LanguageTool misses errors and
// flags valid forms, so the script never fails on them (exit 1 only if it cannot run).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { quotedSpans, unitSentences } from "../src/content/sentences";
import { Unit } from "../src/content/schema";

const SERVER = process.env.LANGUAGETOOL_URL ?? "http://localhost:8010";

interface Match {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string };
}

async function check(text: string, fragment: boolean): Promise<Match[]> {
  const params = new URLSearchParams({ language: "ca-ES", text });
  if (fragment) params.set("disabledRules", "UPPERCASE_SENTENCE_START");
  const res = await fetch(`${SERVER}/v2/check`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error(`LanguageTool ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { matches: Match[] }).matches;
}

function unitDirs(path: string): string[] {
  if (existsSync(join(path, "unit.yaml"))) return [path];
  return readdirSync(path)
    .map((d) => join(path, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "unit.yaml")));
}

const dirs = process.argv.slice(2).flatMap(unitDirs);
if (dirs.length === 0) {
  console.error("usage: npm run languagetool -- <unit dir> ...");
  process.exit(1);
}

let total = 0;
for (const dir of dirs) {
  const unit = Unit.parse(parse(readFileSync(join(dir, "unit.yaml"), "utf8")));
  for (const { where, text, fragment } of unitSentences(unit)) {
    const quoted = quotedSpans(text);
    const matches = (await check(text, fragment ?? false)).filter(
      (m) => !quoted.some(([a, b]) => m.offset < b && m.offset + m.length > a),
    );
    for (const m of matches) {
      total++;
      const found = text.slice(m.offset, m.offset + m.length);
      const fix = m.replacements.slice(0, 3).map((r) => r.value).join(" | ");
      console.log(`${where}  [${m.rule.id}] "${found}" → ${fix || "?"}\n    ${m.message}\n    ${text}`);
    }
  }
}
console.log(`${total} finding(s)`);

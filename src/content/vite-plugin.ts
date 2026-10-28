// Bundles content/units into the app as the virtual module "virtual:content".
// Every unit is validated at build time: a unit with errors fails the build
// instead of shipping a broken exercise.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import type { Plugin } from "vite";
import { parse } from "yaml";
import { checkUnit } from "./check";
import { Unit } from "./schema";

const ID = "virtual:content";
const RESOLVED = `\0${ID}`;

/**
 * Bold and italics as HTML before Markdown sees them. Catalan puts an apostrophe
 * right before the closing marker (**l'**aigua, **he d'**anar), and CommonMark
 * does not close emphasis there, so the asterisks would show. Same rule as the
 * inline renderer of exercises: a marker pair on one line.
 */
export function emphasis(md: string): string {
  return md
    .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?=[^\s*])([^*\n]+?)(?<=[^\s*])\*(?!\*)/g, "<em>$1</em>");
}

/** Theory sections keyed by point id, as HTML. */
function theorySections(md: string): Record<string, string> {
  const parts = md.split(/<!--\s*point:\s*([a-z0-9-]+)\s*-->/);
  const out: Record<string, string> = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i]!] = marked.parse(emphasis(parts[i + 1]!), { async: false });
  return out;
}

export function loadUnits(root: string) {
  const dir = join(root, "content/units");
  const folders = readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "unit.yaml")))
    .sort();
  return folders.map((folder) => {
    const unit = Unit.parse(parse(readFileSync(join(dir, folder, "unit.yaml"), "utf8")));
    const errors = checkUnit(unit).filter((i) => i.severity === "error");
    if (errors.length > 0) {
      throw new Error(`${folder}: ${errors.map((e) => `${e.where}: ${e.message}`).join("\n")}`);
    }
    const theory = theorySections(readFileSync(join(dir, folder, "theory.md"), "utf8"));
    return { ...unit, theory, files: [join(dir, folder, "unit.yaml"), join(dir, folder, "theory.md")] };
  });
}

export function contentPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: "catala-content",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return;
      const units = loadUnits(root).map(({ files, ...unit }) => {
        for (const f of files) this.addWatchFile(f);
        return unit;
      });
      return `export default ${JSON.stringify(units)};`;
    },
  };
}

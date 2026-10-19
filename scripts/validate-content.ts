// Validates unit folders: schema, content checks and theory sections.
// Usage: npm run validate [-- <unit dir or folder of unit dirs> ...]   (default: content/units)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { checkUnit, type Issue } from "../src/content/check";
import { Unit } from "../src/content/schema";

function unitDirs(path: string): string[] {
  if (existsSync(join(path, "unit.yaml"))) return [path];
  return readdirSync(path)
    .map((d) => join(path, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "unit.yaml")));
}

function validateDir(dir: string): Issue[] {
  const where = basename(dir);
  let raw: unknown;
  try {
    raw = parse(readFileSync(join(dir, "unit.yaml"), "utf8"));
  } catch (e) {
    return [{ severity: "error", where, message: `YAML: ${(e as Error).message}` }];
  }
  const parsed = Unit.safeParse(raw);
  if (!parsed.success) {
    return [{ severity: "error", where, message: z.prettifyError(parsed.error) }];
  }
  const unit = parsed.data;
  const issues = checkUnit(unit);
  if (unit.id !== where && !where.startsWith(`${unit.id}-`)) {
    issues.push({ severity: "error", where, message: `folder must be named ${unit.id} or ${unit.id}-<slug>` });
  }
  const theoryPath = join(dir, "theory.md");
  if (!existsSync(theoryPath)) {
    issues.push({ severity: "error", where, message: "missing theory.md" });
  } else {
    const theory = readFileSync(theoryPath, "utf8");
    for (const p of unit.points) {
      if (!theory.includes(`<!-- point: ${p.id} -->`)) {
        issues.push({ severity: "error", where, message: `theory.md has no section <!-- point: ${p.id} -->` });
      }
    }
  }
  return issues;
}

const roots = process.argv.slice(2);
const dirs = (roots.length > 0 ? roots : ["content/units"]).flatMap(unitDirs);
if (dirs.length === 0) {
  console.error("no unit folders found");
  process.exit(1);
}

let errors = 0;
for (const dir of dirs) {
  const issues = validateDir(dir);
  errors += issues.filter((i) => i.severity === "error").length;
  for (const i of issues) console.log(`${i.severity === "error" ? "ERROR" : "warn "} ${i.where}: ${i.message}`);
}
console.log(`${dirs.length} unit(s), ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);

#!/usr/bin/env node
// Mass-deletion guard. Compares the data in the working tree with a git ref (default origin/main)
// and fails if records disappeared without going through data/archive.json, or if a file shrank sharply.
// Why: a model (or a broken collector) that rewrites a file can silently drop half of it; schema
// validation would still pass. This makes "nothing is lost by accident" a hard rule, not a request.
// Usage: node scripts/guard.mjs [--base=origin/main] [--max-removed=3]
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot, parseArgs, isMain } from "./lib.mjs";

// What the guard checks, per data file: which ids must not vanish silently.
export const RULES = [
  ["data/atlas.json", j => j.people.map(p => p.id), "people"],
  ["data/atlas.json", j => j.products.map(p => p.id), "products"],
  ["data/atlas.json", j => j.facts.map(f => f.id), "facts"],
  ["data/events.json", j => j.events.map(e => e.id), "events"],
  ["data/glossary.json", j => j.terms.map(t => t.id), "terms"],
  ["data/library.json", j => j.items.map(i => i.id), "library items"],
  ["data/library-notes.json", j => Object.keys(j.notes || {}), "library cards"],
  ["data/library-notes.json", j => (j.paths || []).map(p => p.id), "reading paths"]
];
const SIZE_FILES = ["data/atlas.json", "data/events.json", "data/glossary.json", "data/library.json", "data/library-notes.json"];

// ---- pure checks (exported for tests)
/** Ids present before, absent now, and not recorded in the archive. */
export const lostIds = (before, after, archived) => { const now = new Set(after); return before.filter(x => !now.has(x) && !archived.has(x)); };
/** True when the live (not `gone`) library items fell by more than 10%. */
export const liveDropped = (libBefore, libAfter) => {
  const a = libBefore.items.filter(i => !i.gone).length, b = libAfter.items.filter(i => !i.gone).length;
  return b < a * 0.9 ? { from: a, to: b } : null;
};
/** Percent a serialised file shrank by, or 0 when it shrank by less than 20%. */
export const shrankPercent = (before, after) => { const b = JSON.stringify(before).length, a = JSON.stringify(after).length; return a < b * 0.8 ? Math.round(100 - a / b * 100) : 0; };

/** Runs every rule; `old(rel)` and `cur(rel)` return parsed JSON or null. Returns { errors, compared }. */
export function runGuard({ old, cur, base, maxRemoved = 3 }) {
  const errors = [];
  const archived = new Set((cur("data/archive.json")?.items || []).map(a => a.id));
  let compared = 0;
  for (const [rel, ids, label] of RULES) {
    const a = old(rel), b = cur(rel);
    if (!a) continue; // new file or no base: nothing to compare
    if (!b) { errors.push(`${rel} was deleted`); continue; }
    compared++;
    const lost = lostIds(ids(a), ids(b), archived);
    if (lost.length > maxRemoved) errors.push(`${rel}: ${lost.length} ${label} removed without archiving (limit ${maxRemoved}): ${lost.slice(0, 8).join(", ")}${lost.length > 8 ? "…" : ""}`);
  }
  // The library marks vanished items as `gone` instead of deleting them; a sudden wave of `gone` means a source broke.
  const la = old("data/library.json"), lb = cur("data/library.json");
  const drop = la && lb && liveDropped(la, lb);
  if (drop) errors.push(`data/library.json: live items fell from ${drop.from} to ${drop.to} (more than 10%)`);
  for (const rel of SIZE_FILES) {
    const a = old(rel), b = cur(rel);
    if (!a || !b) continue;
    const pct = shrankPercent(a, b);
    if (pct) errors.push(`${rel}: shrank by ${pct}% compared with ${base}`);
  }
  return { errors, compared };
}

function main() {
  const ROOT = repoRoot(true);
  const args = parseArgs(process.argv.slice(2));
  const BASE = args.base || "origin/main";
  const MAX_REMOVED = +(args["max-removed"] ?? 3);
  const cur = rel => { const p = join(ROOT, rel); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };
  try { execFileSync("git", ["rev-parse", "--verify", `${BASE}^{commit}`], { cwd: ROOT, stdio: "ignore" }); }
  catch { console.log(`ERROR base ref ${BASE} does not exist (shallow clone or typo); refusing to pass blind`); process.exit(1); }
  const old = rel => { try { return JSON.parse(execFileSync("git", ["show", `${BASE}:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64e6, stdio: ["ignore", "pipe", "ignore"] })); } catch { return null; } };
  const { errors, compared } = runGuard({ old, cur, base: BASE, maxRemoved: MAX_REMOVED });
  if (!compared && !args["allow-empty"]) errors.push(`nothing was compared against ${BASE}; pass --allow-empty only for a brand-new repository`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(errors.length ? `\nGUARD FAILED against ${BASE}` : `GUARD OK against ${BASE} (${compared} record sets compared)`);
  process.exit(errors.length ? 1 : 0);
}
if (isMain(import.meta.url)) main();

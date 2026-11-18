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

// What the guard checks, per data file: which ids must not vanish silently. `strict` record sets allow no removal
// at all without an archive entry (REVIEW.md rule 2); the generated library sets tolerate a few (pages do move).
export const RULES = [
  ["data/atlas.json", j => j.people.map(p => p.id), "people", true],
  ["data/atlas.json", j => j.products.map(p => p.id), "products", true],
  ["data/atlas.json", j => j.facts.map(f => f.id), "facts", true],
  ["data/events.json", j => j.events.map(e => e.id), "events", true],
  ["data/glossary.json", j => j.terms.map(t => t.id), "terms", true],
  ["data/opinions.json", j => (j.opinions || []).map(o => o.id), "opinions", true],
  ["data/modules.json", j => (j.modules || []).map(m => m.id), "sections", true],
  ["data/digests/index.json", j => (j.digests || []).map(d => d.date), "digests", true],
  ["data/library.json", j => j.items.map(i => i.id), "library items"],
  ["data/library-notes.json", j => Object.keys(j.notes || {}), "library cards"],
  ["data/library-notes.json", j => (j.paths || []).map(p => p.id), "reading paths"]
];
const SIZE_FILES = ["data/atlas.json", "data/events.json", "data/glossary.json", "data/opinions.json", "data/library.json", "data/library-notes.json"];
/** Archive entries that really hold the removed record: a snapshot of it, not an empty stub. */
export const archivedIds = archive => new Set((archive?.items || []).filter(a => a.snapshot && Object.keys(a.snapshot).length >= 2 && (a.snapshot.id ?? a.id) === a.id).map(a => a.id));

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
  const archived = archivedIds(cur("data/archive.json"));
  // the archive only grows: an entry that disappears would hide the record it stood for
  const archBefore = old("data/archive.json"), archNow = cur("data/archive.json");
  if (archBefore) { const lost = lostIds((archBefore.items || []).map(a => `${a.kind}:${a.id}`), (archNow?.items || []).map(a => `${a.kind}:${a.id}`), new Set()); if (lost.length) errors.push(`data/archive.json: ${lost.length} archive entr${lost.length === 1 ? "y" : "ies"} removed (${lost.slice(0, 5).join(", ")}); the archive is append-only`); }
  let compared = 0;
  for (const [rel, ids, label, strict] of RULES) {
    const a = old(rel), b = cur(rel);
    if (!a) continue; // new file or no base: nothing to compare
    if (!b) { errors.push(`${rel} was deleted`); continue; }
    compared++;
    const lost = lostIds(ids(a), ids(b), archived);
    const limit = strict ? 0 : maxRemoved;
    if (lost.length > limit) errors.push(`${rel}: ${lost.length} ${label} removed without archiving (limit ${limit}): ${lost.slice(0, 8).join(", ")}${lost.length > 8 ? "…" : ""}`);
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

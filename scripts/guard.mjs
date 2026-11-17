#!/usr/bin/env node
// Mass-deletion guard. Compares the data in the working tree with a git ref (default origin/main)
// and fails if records disappeared without going through data/archive.json, or if a file shrank sharply.
// Why: a model (or a broken collector) that rewrites a file can silently drop half of it; schema
// validation would still pass. This makes "nothing is lost by accident" a hard rule, not a request.
// Usage: node scripts/guard.mjs [--base=origin/main] [--max-removed=3]
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.ATLAS_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const BASE = args.base || "origin/main";
const MAX_REMOVED = +(args["max-removed"] ?? 3);

const cur = rel => { const p = join(ROOT, rel); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };
try { execFileSync("git", ["rev-parse", "--verify", `${BASE}^{commit}`], { cwd: ROOT, stdio: "ignore" }); }
catch { console.log(`ERROR base ref ${BASE} does not exist (shallow clone or typo); refusing to pass blind`); process.exit(1); }
const old = rel => { try { return JSON.parse(execFileSync("git", ["show", `${BASE}:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64e6, stdio: ["ignore", "pipe", "ignore"] })); } catch { return null; } };

const errors = [];
const archived = new Set((cur("data/archive.json")?.items || []).map(a => a.id));
const RULES = [
  ["data/atlas.json", j => j.people.map(p => p.id), "people"],
  ["data/atlas.json", j => j.products.map(p => p.id), "products"],
  ["data/atlas.json", j => j.facts.map(f => f.id), "facts"],
  ["data/events.json", j => j.events.map(e => e.id), "events"],
  ["data/glossary.json", j => j.terms.map(t => t.id), "terms"],
  ["data/library.json", j => j.items.map(i => i.id), "library items"],
  ["data/library-notes.json", j => Object.keys(j.notes || {}), "library cards"],
  ["data/library-notes.json", j => (j.paths || []).map(p => p.id), "reading paths"]
];
let compared = 0;
for (const [rel, ids, label] of RULES) {
  const a = old(rel), b = cur(rel);
  if (!a) continue; // new file or no base: nothing to compare
  if (!b) { errors.push(`${rel} was deleted`); continue; }
  compared++;
  const now = new Set(ids(b));
  const lost = ids(a).filter(x => !now.has(x) && !archived.has(x));
  if (lost.length > MAX_REMOVED) errors.push(`${rel}: ${lost.length} ${label} removed without archiving (limit ${MAX_REMOVED}): ${lost.slice(0, 8).join(", ")}${lost.length > 8 ? "…" : ""}`);
}
// The library marks vanished items as `gone` instead of deleting them; a sudden wave of `gone` means a source broke.
const la = old("data/library.json"), lb = cur("data/library.json");
if (la && lb) {
  const liveA = la.items.filter(i => !i.gone).length, liveB = lb.items.filter(i => !i.gone).length;
  if (liveB < liveA * 0.9) errors.push(`data/library.json: live items fell from ${liveA} to ${liveB} (more than 10%)`);
}
for (const rel of ["data/atlas.json", "data/events.json", "data/glossary.json", "data/library.json", "data/library-notes.json"]) {
  const a = old(rel); const p = join(ROOT, rel);
  if (!a || !existsSync(p)) continue;
  const before = JSON.stringify(a).length, after = JSON.stringify(cur(rel)).length;
  if (after < before * 0.8) errors.push(`${rel}: shrank by ${Math.round(100 - after / before * 100)}% compared with ${BASE}`);
}
if (!compared && !args["allow-empty"]) errors.push(`nothing was compared against ${BASE}; pass --allow-empty only for a brand-new repository`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(errors.length ? `\nGUARD FAILED against ${BASE}` : `GUARD OK against ${BASE} (${compared} record sets compared)`);
process.exit(errors.length ? 1 : 0);

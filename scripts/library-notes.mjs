#!/usr/bin/env node
// The only way the morning model touches data/library-notes.json (2000+ cards, too big to edit by hand safely).
//   node scripts/library-notes.mjs --todo [--limit=40]   prints a TSV of catalog items without a Russian card
//   node scripts/library-notes.mjs --add=/tmp/cards.json  merges {"<id>": {"t","s","w"?,"d"?}} after cleaning
//   add --replace to overwrite existing cards (fact fixes); without it existing cards are kept. At most 150 cards per run.
// Cards for unknown ids are dropped, lengths are clipped, audiences outside the allowed list are removed.
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot, parseArgs, readJson } from "./lib.mjs";

const ROOT = repoRoot(true);
const args = parseArgs(process.argv.slice(2));
const lib = readJson(join(ROOT, "data/library.json"));
const P = join(ROOT, "data/library-notes.json");
const raw = existsSync(P) ? readFileSync(P, "utf8") : null;
const notes = raw ? JSON.parse(raw) : { notes: {}, paths: [] };
notes.notes ||= {}; notes.paths ||= [];
const byId = new Map(lib.items.map(i => [i.id, i]));
const AUD = new Set(["learners", "developers", "researchers", "business", "policy", "everyone"]);
const NO_ACTION = new Set(["news", "research", "customers", "events", "talks"]);
const clean = s => String(s || "").replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim();

if (args.todo) {
  const todo = lib.items.filter(i => !i.gone && !notes.notes[i.id]).sort((a, b) => String(b.date || b.added || "").localeCompare(String(a.date || a.added || ""))).slice(0, +(args.limit || 40));
  console.log(todo.length ? "id\tsection\ttitle\tdescription\turl" : "No items without a card.");
  for (const i of todo) console.log([i.id, i.section, i.title, (i.desc || "").replace(/\s+/g, " "), i.url].join("\t"));
} else if (args.add) {
  const add = readJson(args.add);
  let n = 0, skipped = 0, kept = 0;
  const entries = Object.entries(add);
  if (entries.length > 150) { console.error(`refusing ${entries.length} cards in one run (limit 150); split the batch`); process.exit(1); }
  for (const [id, c] of entries) {
    const it = byId.get(id);
    if (!it || !c?.t || !c?.s) { skipped++; continue; }
    if (notes.notes[id] && !args.replace) { kept++; continue; }
    const card = { t: clean(c.t).slice(0, 140), s: clean(c.s).slice(0, 320) };
    const w = (Array.isArray(c.w) ? c.w : []).filter(x => AUD.has(x)).slice(0, 3); if (w.length) card.w = w;
    if (c.d && !NO_ACTION.has(it.section)) card.d = clean(c.d).slice(0, 140);
    notes.notes[id] = card; n++;
  }
  writeFileSync(P + ".tmp", JSON.stringify(notes) + "\n"); renameSync(P + ".tmp", P);
  const v = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "validate.mjs"), "--quiet"], { env: { ...process.env, ATLAS_ROOT: ROOT }, encoding: "utf8" });
  if (v.status !== 0) { if (raw) writeFileSync(P, raw); console.error(v.stdout + v.stderr + "\nvalidation failed: data/library-notes.json restored"); process.exit(1); }
  console.log(`added ${n} card(s), kept ${kept} existing (use --replace to overwrite), skipped ${skipped}`);
} else { console.log("usage: --todo [--limit=40] | --add=<cards.json>"); process.exit(1); }

#!/usr/bin/env node
// The only way the morning model touches data/library-notes.json (2000+ cards, too big to edit by hand safely).
//   node scripts/library-notes.mjs --todo [--limit=40]   prints a TSV of catalog items without a Russian card
//   node scripts/library-notes.mjs --add=/tmp/cards.json  merges {"<id>": {"t","s","w"?,"d"?}} after cleaning
// Cards for unknown ids are dropped, lengths are clipped, audiences outside the allowed list are removed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.ATLAS_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const lib = JSON.parse(readFileSync(join(ROOT, "data/library.json"), "utf8"));
const P = join(ROOT, "data/library-notes.json");
const notes = existsSync(P) ? JSON.parse(readFileSync(P, "utf8")) : { notes: {}, paths: [] };
const byId = new Map(lib.items.map(i => [i.id, i]));
const AUD = new Set(["learners", "developers", "researchers", "business", "policy", "everyone"]);
const NO_ACTION = new Set(["news", "research", "customers", "events", "talks"]);
const clean = s => String(s || "").replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim();

if (args.todo) {
  const todo = lib.items.filter(i => !i.gone && !notes.notes[i.id]).sort((a, b) => String(b.date || b.added || "").localeCompare(String(a.date || a.added || ""))).slice(0, +(args.limit || 40));
  console.log(todo.length ? "id\tsection\ttitle\tdescription\turl" : "No items without a card.");
  for (const i of todo) console.log([i.id, i.section, i.title, (i.desc || "").replace(/\s+/g, " "), i.url].join("\t"));
} else if (args.add) {
  const add = JSON.parse(readFileSync(args.add, "utf8"));
  let n = 0, skipped = 0;
  for (const [id, c] of Object.entries(add)) {
    const it = byId.get(id);
    if (!it || !c?.t || !c?.s) { skipped++; continue; }
    const card = { t: clean(c.t).slice(0, 140), s: clean(c.s).slice(0, 320) };
    const w = (c.w || []).filter(x => AUD.has(x)).slice(0, 3); if (w.length) card.w = w;
    if (c.d && !NO_ACTION.has(it.section)) card.d = clean(c.d).slice(0, 140);
    notes.notes[id] = card; n++;
  }
  writeFileSync(P, JSON.stringify(notes) + "\n");
  console.log(`added ${n} card(s), skipped ${skipped}`);
} else { console.log("usage: --todo [--limit=40] | --add=<cards.json>"); process.exit(1); }

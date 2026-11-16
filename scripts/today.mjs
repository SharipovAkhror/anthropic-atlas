#!/usr/bin/env node
// Prints the worklist for today's run in a compact, model-friendly form:
//   - pipeline health (inbox date, failed sources, last published digest)
//   - inbox items, grouped and de-duplicated against events already on the board
//   - page changes on watched pages
//   - the entities due for rolling re-verification today (each entity once a week)
// Usage: node scripts/today.mjs [--date=YYYY-MM-DD] [--json]
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.ATLAS_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const DATE = args.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
const read = rel => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const atlas = read("data/atlas.json"), events = read("data/events.json").events;
const inbox = existsSync(join(ROOT, "pipeline/inbox/latest.json")) ? read("pipeline/inbox/latest.json") : { date: null, sources: [], items: [] };
const digests = read("data/digests/index.json").digests;

const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const knownUrls = new Set(events.flatMap(e => e.sources.map(s => s.url)));
const knownTitles = events.filter(e => e.date >= new Date(Date.parse(DATE) - 21 * 864e5).toISOString().slice(0, 10)).map(e => norm(e.title.en));
const similar = t => { const w = new Set(norm(t).split(" ").filter(x => x.length > 3)); return knownTitles.find(k => { const kw = k.split(" ").filter(x => x.length > 3); const hit = kw.filter(x => w.has(x)).length; return kw.length && hit / kw.length >= 0.6; }); };

const items = inbox.items.map(i => ({ ...i, dupe: i.kind === "page-watch" ? null : knownUrls.has(i.url) ? "url already on board" : similar(i.title) ? `similar to: "${similar(i.title)}"` : null }));
const fresh = items.filter(i => !i.dupe);

// rolling re-verification: entity index modulo 7 == weekday
const weekday = new Date(DATE + "T12:00:00Z").getUTCDay();
const all = [...atlas.people.map(p => ({ kind: "person", id: p.id, name: p.name, status: p.status, verifiedAt: p.verifiedAt, source: p.sources[0].url })), ...atlas.products.map(p => ({ kind: "product", id: p.id, name: p.name, status: p.status, verifiedAt: p.verifiedAt, source: p.sources[0].url })), ...atlas.facts.map(f => ({ kind: "fact", id: f.id, name: f.label.en, value: f.value, verifiedAt: f.asOf, source: f.sources[0].url }))];
const due = all.filter((e, i) => i % 7 === weekday && e.status !== "former" && e.status !== "retired");
const overdue = all.filter(e => e.verifiedAt && (Date.parse(DATE) - Date.parse(e.verifiedAt)) / 864e5 > 45 && !due.includes(e)).slice(0, 5);

const out = {
  date: DATE,
  health: {
    inboxDate: inbox.date,
    inboxIsFresh: inbox.date === DATE || inbox.date === new Date(Date.parse(DATE) - 864e5).toISOString().slice(0, 10),
    failedSources: inbox.sources.filter(s => !s.ok).map(s => `${s.id} (${s.error})`),
    lastPublishedDigest: digests[0]?.date || null
  },
  candidates: fresh.map(i => ({ id: i.id, source: i.source, tier: i.tier, title: i.title, url: i.url, published: i.published, snippet: (i.snippet || "").slice(0, 600), added: i.added, removed: i.removed })),
  skippedAsDuplicates: items.filter(i => i.dupe).map(i => `${i.title} — ${i.dupe}`),
  reverifyToday: [...due, ...overdue]
};

if (args.json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`# Atlas run ${DATE}\n`);
console.log(`Inbox: ${inbox.date || "missing"}${out.health.inboxIsFresh ? "" : "  ⚠ STALE — run: NODE_USE_ENV_PROXY=1 node scripts/collect.mjs"}`);
if (out.health.failedSources.length) console.log(`Failed sources: ${out.health.failedSources.join("; ")}`);
console.log(`Last published digest: ${out.health.lastPublishedDigest}\n`);
console.log(`## Candidates (${out.candidates.length}) — triage each: event / entity change / discard`);
for (const c of out.candidates) {
  console.log(`\n[${c.id}] tier ${c.tier} · ${c.source} · ${c.published || "?"}\n  ${c.title}\n  ${c.url}`);
  if (c.snippet) console.log(`  ${c.snippet.replace(/\n/g, " ").slice(0, 400)}`);
  if (c.added?.length) console.log(`  + ${c.added.slice(0, 12).join("\n  + ")}`);
  if (c.removed?.length) console.log(`  - ${c.removed.slice(0, 12).join("\n  - ")}`);
}
if (out.skippedAsDuplicates.length) console.log(`\n## Already on the board (skip)\n- ${out.skippedAsDuplicates.join("\n- ")}`);
console.log(`\n## Re-verify today (${out.reverifyToday.length}) — open the source, confirm, set verifiedAt=${DATE} (facts: confirm the value; change asOf only when the figure itself changes)`);
for (const e of out.reverifyToday) console.log(`- ${e.kind} ${e.id} — ${e.name}${e.value ? ` = ${e.value}` : ""} (last ${e.verifiedAt}) · ${e.source}`);

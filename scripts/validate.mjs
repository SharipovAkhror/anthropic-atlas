#!/usr/bin/env node
// Atlas validator: JSON Schema (structure) + integrity and editorial rules.
// Usage: node scripts/validate.mjs [--today=YYYY-MM-DD] [--quiet]
// Exit code 0 = valid (warnings allowed), 1 = errors. Run it after EVERY data edit.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, parseArgs, tashkentDate } from "./lib.mjs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ROOT = repoRoot(true);
const args = parseArgs(process.argv.slice(2));
const TODAY = args.today || [new Date().toISOString().slice(0, 10), tashkentDate()].sort().at(-1); // latest of UTC and Tashkent dates
const STALE_DAYS = 60;

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function load(rel) {
  const p = join(ROOT, rel);
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { err(rel, `cannot parse JSON (${e.message})`); return null; }
}

// ---------- 1. Schema validation ----------
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
for (const f of readdirSync(join(ROOT, "schema"))) ajv.addSchema(load(`schema/${f}`));

function check(rel, schemaId) {
  const data = load(rel);
  if (!data) return null;
  const validate = ajv.getSchema(schemaId);
  if (!validate(data)) {
    for (const e of validate.errors.slice(0, 40)) err(rel, `${e.instancePath || "/"} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ""}${e.params?.allowedValues ? ` ${JSON.stringify(e.params.allowedValues)}` : ""}`);
    return null; // wrong shape: the integrity rules below would only crash on it
  }
  return data;
}

const atlas = check("data/atlas.json", "atlas.schema.json");
const events = check("data/events.json", "events.schema.json");
const archive = check("data/archive.json", "archive.schema.json");
const glossary = check("data/glossary.json", "glossary.schema.json");
const modules = check("data/modules.json", "modules.schema.json");
const opinions = existsSync(join(ROOT, "data/opinions.json")) ? check("data/opinions.json", "opinions.schema.json") : null;
const library = existsSync(join(ROOT, "data/library.json")) ? check("data/library.json", "library.schema.json") : null;
const libNotes = existsSync(join(ROOT, "data/library-notes.json")) ? check("data/library-notes.json", "library-notes.schema.json") : null;
const sourcesReg = load("sources/sources.json");
const digestDir = join(ROOT, "data/digests");
const digestFiles = existsSync(digestDir) ? readdirSync(digestDir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : [];
const digests = digestFiles.map(f => [f, check(`data/digests/${f}`, "digest.schema.json")]);
const digestIndex = load("data/digests/index.json");

if (!atlas || !events) { report(); }

// ---------- 2. Integrity rules ----------
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const dupes = arr => arr.filter((x, i) => arr.indexOf(x) !== i);
const blocked = new Set(sourcesReg?.blockedDomains || []);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

function checkSources(file, where, list) {
  for (const s of list || []) {
    const h = host(s.url);
    if (!h) err(file, `${where}: bad url ${s.url}`);
    else if ([...blocked].some(b => h === b || h.endsWith("." + b))) err(file, `${where}: source domain ${h} is on the blocked list (sources/sources.json)`);
  }
}

// Opinions: named author, a real source, no duplicates, not from the future. They are never shown as facts.
if (opinions) {
  const F = "data/opinions.json";
  for (const d of new Set(dupes(opinions.opinions.map(o => o.id)))) err(F, `duplicate opinion id "${d}"`);
  for (const o of opinions.opinions) {
    checkSources(F, o.id, o.sources);
    if (o.date > TODAY) err(F, `${o.id}: date ${o.date} is in the future`);
    if (/[!—]/.test(o.claim.ru)) warn(F, `${o.id}: Russian claim has an exclamation mark or em dash`);
  }
}

if (atlas) {
  const F = "data/atlas.json";
  const zoneIds = new Set(atlas.zones.map(z => z.id));
  const clusterIds = new Set(atlas.clusters.map(c => c.id));
  const allIds = [...atlas.people.map(p => p.id), ...atlas.products.map(p => p.id)];
  for (const d of new Set(dupes(allIds))) err(F, `duplicate id "${d}" (ids must be unique across people and products)`);
  for (const d of new Set(dupes(atlas.facts.map(f => f.id)))) err(F, `duplicate fact id "${d}"`);
  const idSet = new Set(allIds);

  for (const p of atlas.people) {
    const w = `people/${p.id}`;
    if (!zoneIds.has(p.zone)) err(F, `${w}: unknown zone "${p.zone}"`);
    if (p.status === "former" && !p.until) err(F, `${w}: status "former" requires "until"`);
    if (p.status === "active" && p.until) err(F, `${w}: active person must not have "until"`);
    if (p.verifiedAt > TODAY) err(F, `${w}: verifiedAt in the future`);
    if (days(p.verifiedAt, TODAY) > STALE_DAYS) warn(F, `${w}: not re-verified for ${days(p.verifiedAt, TODAY)} days`);
    if (p.kind === "person" && !p.links?.wikipedia && !p.links?.official && !p.links?.linkedin && !p.links?.site && !p.links?.github) warn(F, `${w}: no reference link (wikipedia/official/linkedin/site/github)`);
    checkSources(F, w, p.sources);
  }
  for (const p of atlas.products) {
    const w = `products/${p.id}`;
    if (!clusterIds.has(p.cluster)) err(F, `${w}: unknown cluster "${p.cluster}"`);
    for (const o of p.owners) if (!idSet.has(o)) err(F, `${w}: owner "${o}" does not exist`);
    if (p.verifiedAt > TODAY) err(F, `${w}: verifiedAt in the future`);
    if (days(p.verifiedAt, TODAY) > STALE_DAYS) warn(F, `${w}: not re-verified for ${days(p.verifiedAt, TODAY)} days`);
    checkSources(F, w, p.sources);
  }
  for (const f of atlas.facts) {
    if (f.asOf > TODAY) err(F, `facts/${f.id}: asOf in the future`);
    checkSources(F, `facts/${f.id}`, f.sources);
  }
  atlas.edges.forEach((e, i) => {
    if (!idSet.has(e.from)) err(F, `edges[${i}]: from "${e.from}" does not exist`);
    if (!idSet.has(e.to)) err(F, `edges[${i}]: to "${e.to}" does not exist`);
  });
  const edgeKeys = atlas.edges.map(e => `${e.from}>${e.to}`);
  for (const d of new Set(dupes(edgeKeys))) err(F, `duplicate edge ${d}`);
  if (atlas.meta.updatedAt > TODAY) err(F, "meta.updatedAt in the future");

  if (events) {
    const E = "data/events.json";
    const ev = events.events;
    for (const d of new Set(dupes(ev.map(e => e.id)))) err(E, `duplicate event id "${d}"`);
    ev.forEach((e, i) => {
      const w = `events/${e.id}`;
      if (!e.id.startsWith(e.date)) err(E, `${w}: id must start with its date ${e.date}`);
      if (e.date > TODAY) err(E, `${w}: event date is in the future (announced plans go into the summary of today's event instead)`);
      if (e.addedAt > TODAY) err(E, `${w}: addedAt in the future`);
      for (const x of e.entities || []) if (!idSet.has(x)) err(E, `${w}: entity "${x}" does not exist`);
      checkSources(E, w, e.sources);
      if (i > 0 && ev[i - 1].date < e.date) err(E, `${w}: events must be sorted newest first`);
    });
    for (const [f, d] of digests) {
      if (!d) continue;
      const evIds = new Set(ev.map(e => e.id));
      for (const n of d.news) if (!evIds.has(n)) err(`data/digests/${f}`, `news id "${n}" not found in events.json`);
      if (f !== `${d.date}.json`) err(`data/digests/${f}`, "file name must equal its date");
    }
  }
}

if (glossary) {
  for (const d of new Set(dupes(glossary.terms.map(t => t.id)))) err("data/glossary.json", `duplicate term id "${d}"`);
  for (const t of glossary.terms) checkSources("data/glossary.json", `terms/${t.id}`, t.sources);
}
if (archive) {
  for (const a of archive.items) if (a.removedAt > TODAY) err("data/archive.json", `${a.id}: removedAt in the future`);
}
if (modules) {
  for (const m of modules.modules) {
    if (!m.source) continue;
    const [file, key] = m.source.split("#");
    const d = load(`data/${file}`);
    if (d && key && !Array.isArray(d[key])) err("data/modules.json", `${m.id}: source ${m.source} is not an array`);
  }
}
if (library) {
  const L = "data/library.json";
  const secIds = new Set(library.sections.map(s => s.id));
  for (const d of new Set(dupes(library.items.map(i => i.id)))) err(L, `duplicate item id "${d}"`);
  for (const d of new Set(dupes(library.items.map(i => i.url)))) err(L, `duplicate url "${d}"`);
  for (const i of library.items) {
    if (!secIds.has(i.section)) err(L, `${i.id}: unknown section "${i.section}"`);
    if (i.date > TODAY) err(L, `${i.id}: date in the future`);
  }
  const live = library.items.filter(i => !i.gone).length;
  if (live < 500) err(L, `only ${live} live items: the catalog looks broken (expected well over 1000)`);
  if (libNotes) {
    const ids = new Set(library.items.map(i => i.id));
    const orphans = Object.keys(libNotes.notes).filter(k => !ids.has(k));
    if (orphans.length) warn("data/library-notes.json", `${orphans.length} note(s) for items not in the catalog`);
    for (const p of libNotes.paths) for (const x of p.items) if (!ids.has(x.id)) err("data/library-notes.json", `path ${p.id}: item "${x.id}" not in the catalog`);
  }
}
if (digestIndex) {
  const listed = new Set((digestIndex.digests || []).map(d => d.date));
  for (const f of digestFiles) if (!listed.has(f.slice(0, 10))) err("data/digests/index.json", `digest ${f} missing from index`);
  for (const d of listed) if (!digestFiles.includes(`${d}.json`)) err("data/digests/index.json", `index lists ${d} but file is missing`);
}
// digests agree with the data they describe
{
  const libIds = new Set((library?.items || []).map(i => i.id));
  const pools = { person: atlas?.people, product: atlas?.products, fact: [...(atlas?.facts || []), ...(glossary?.terms || [])], event: events?.events };
  for (const [f, d] of digests) {
    if (!d) continue;
    const F = `data/digests/${f}`;
    if (d.date > TODAY) err(F, "digest dated in the future");
    if (library) for (const x of d.library || []) if (!libIds.has(x)) err(F, `library id "${x}" not in the catalog`);
    for (const k of ["added", "updated"]) for (const c of d[k] || []) if (pools[c.kind] && !pools[c.kind].some(p => p.id === c.id)) err(F, `${k}: ${c.kind} "${c.id}" not in the data`);
    const idx = digestIndex?.digests?.find(x => x.date === d.date);
    if (idx?.counts && idx.counts.news !== d.news.length) err("data/digests/index.json", `${d.date}: counts differ from the digest file`);
  }
}
// the RSS feed must parse, or every reader drops it
if (existsSync(join(ROOT, "data/feed.xml"))) {
  const feed = readFileSync(join(ROOT, "data/feed.xml"), "utf8");
  if (!/^<\?xml[^>]*\?>\s*<rss[\s\S]*<\/channel><\/rss>\s*$/.test(feed)) err("data/feed.xml", "truncated or not RSS");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(feed)) err("data/feed.xml", "control character (invalid XML)");
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(feed)) err("data/feed.xml", "unescaped &");
  const open = (feed.match(/<item>/g) || []).length, close = (feed.match(/<\/item>/g) || []).length;
  if (open !== close) err("data/feed.xml", "unbalanced <item> tags");
}
// library links point only at Anthropic's own sites (a broken or hijacked source cannot inject other hosts)
if (library) {
  const OK = /^https:\/\/([a-z0-9-]+\.)*(anthropic\.com|claude\.com|claude\.ai|transformer-circuits\.pub|modelcontextprotocol\.io|skilljar\.com|github\.com|youtube\.com|youtu\.be)(\/|$)/i;
  const bad = library.items.filter(i => !OK.test(i.url));
  for (const i of bad.slice(0, 10)) err("data/library.json", `${i.id}: url outside Anthropic's sites (${i.url})`);
  if (bad.length > 10) err("data/library.json", `…and ${bad.length - 10} more urls outside Anthropic's sites`);
  const today = library.items.filter(i => i.added === TODAY).length;
  if (today > 400) warn("data/library.json", `${today} items first seen today: check the sources`);
  if (libNotes) {
    const live = library.items.filter(i => !i.gone), carded = live.filter(i => libNotes.notes[i.id]).length;
    if (carded < live.length * .5) warn("data/library-notes.json", `only ${carded} of ${live.length} live items have a Russian card`);
    for (const p of libNotes.paths) if (p.items.length < 4) err("data/library-notes.json", `path ${p.id} has only ${p.items.length} items`);
  }
}

// ---------- 3. Rules the testers asked for (QA round, 2026-11-18) ----------
const realDay = d => { const t = Date.parse(d + "T00:00:00Z"); return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d; };
function walk(x, fn, path = "") {
  if (typeof x === "string") fn(x, path);
  else if (Array.isArray(x)) x.forEach((v, i) => walk(v, fn, `${path}[${i}]`));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) walk(v, fn, path ? `${path}.${k}` : k);
}
const texts = [["data/atlas.json", atlas], ["data/events.json", events], ["data/glossary.json", glossary], ["data/opinions.json", opinions], ["data/modules.json", modules], ...digests.map(([f, d]) => [`data/digests/${f}`, d])];
for (const [F, d] of texts) {
  if (!d) continue;
  let dash = 0, bang = 0;
  walk(d, (v, path) => {
    // a date that only looks like one: 2026-02-31 passes the format check but not the calendar
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !realDay(v)) err(F, `${path}: ${v} is not a real date`);
    if (/(^|\.)(ru|en)$/.test(path) && !/\S/.test(v)) err(F, `${path}: empty text`);
    if (/(^|\.)ru$/.test(path)) { if (v.includes("—")) dash++; if (/!(\s|$)/.test(v)) bang++; }
  });
  if (dash || bang) warn(F, `Russian text has ${dash} em dash(es) and ${bang} exclamation mark(s) (REVIEW.md: avoid both)`);
}
if (atlas) {
  const F = "data/atlas.json";
  for (const p of atlas.people) if (p.since && p.until && String(p.until) < String(p.since).slice(0, String(p.until).length)) err(F, `people/${p.id}: until ${p.until} is before since ${p.since}`);
  for (const p of atlas.people) if (p.since && String(p.since) > TODAY) err(F, `people/${p.id}: since ${p.since} is in the future`);
  for (const d of new Set(dupes(atlas.people.map(p => p.name.trim().toLowerCase())))) err(F, `two people share the name "${d}"`);
  for (const d of new Set(dupes(atlas.products.map(p => p.name.trim().toLowerCase())))) err(F, `two products share the name "${d}"`);
  const apiIds = atlas.products.flatMap(p => (p.children || []).map(c => c.apiId).filter(Boolean));
  for (const d of new Set(dupes(apiIds))) err(F, `API id "${d}" appears twice`);
}
if (glossary) for (const d of new Set(dupes(glossary.terms.map(t => t.term.trim().toLowerCase())))) err("data/glossary.json", `term "${d}" appears twice`);
if (modules) for (const d of new Set(dupes(modules.modules.map(m => m.id)))) err("data/modules.json", `duplicate module id "${d}"`);
if (digestIndex?.digests) {
  const I = "data/digests/index.json", list = digestIndex.digests;
  // health.yml and the site read digests[0] as the newest: the order is part of the contract
  list.forEach((x, i) => { if (i && list[i - 1].date <= x.date) err(I, `${x.date}: index must be sorted newest first, without repeats`); });
  for (const [f, d] of digests) {
    const x = d && list.find(y => y.date === d.date); if (!x) continue;
    for (const k of ["news", "added", "updated", "removed", "library"]) if (x.counts && k in x.counts && Array.isArray(d[k]) && x.counts[k] !== d[k].length) err(I, `${d.date}: counts.${k} is ${x.counts[k]}, the digest has ${d[k].length}`);
    if (x.headline?.ru && d.headline?.ru && x.headline.ru !== d.headline.ru) err(I, `${d.date}: headline differs from the digest file`);
  }
  const newest = digests.map(([, d]) => d).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date))[0];
  // a collector that reached no source at all looks like a quiet day unless someone says so
  if (newest?.stats && newest.stats.sourcesOk === 0) warn(`data/digests/${newest.date}.json`, "no source was reachable: this is an outage, not a quiet day");
}

report();

function report() {
  if (!args.quiet) for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  const counts = atlas ? `${atlas.people.length} people, ${atlas.products.length} products, ${events?.events.length ?? 0} events, ${glossary?.terms.length ?? 0} terms, ${library?.items.filter(i => !i.gone).length ?? 0} library items` : "";
  console.log(errors.length ? `\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s). ${counts}` : `\nOK: 0 errors, ${warnings.length} warning(s). ${counts}`);
  process.exit(errors.length ? 1 : 0);
}

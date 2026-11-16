#!/usr/bin/env node
// Atlas validator: JSON Schema (structure) + integrity and editorial rules.
// Usage: node scripts/validate.mjs [--today=YYYY-MM-DD] [--quiet]
// Exit code 0 = valid (warnings allowed), 1 = errors. Run it after EVERY data edit.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const TODAY = args.today || new Date().toISOString().slice(0, 10);
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
  }
  return data;
}

const atlas = check("data/atlas.json", "atlas.schema.json");
const events = check("data/events.json", "events.schema.json");
const archive = check("data/archive.json", "archive.schema.json");
const glossary = check("data/glossary.json", "glossary.schema.json");
const modules = check("data/modules.json", "modules.schema.json");
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
    if (p.kind === "person" && !p.links?.wikipedia && !p.links?.official && !p.links?.linkedin && !p.links?.site) warn(F, `${w}: no reference link (wikipedia/official/linkedin/site)`);
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
    for (const d of new Set(dupes(ev.map(e => e.sources[0].url)))) warn(E, `two events share the same primary source ${d}`);
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
if (digestIndex) {
  const listed = new Set((digestIndex.digests || []).map(d => d.date));
  for (const f of digestFiles) if (!listed.has(f.slice(0, 10))) err("data/digests/index.json", `digest ${f} missing from index`);
  for (const d of listed) if (!digestFiles.includes(`${d}.json`)) err("data/digests/index.json", `index lists ${d} but file is missing`);
}

report();

function report() {
  if (!args.quiet) for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  const counts = atlas ? `${atlas.people.length} people, ${atlas.products.length} products, ${events?.events.length ?? 0} events, ${glossary?.terms.length ?? 0} terms` : "";
  console.log(errors.length ? `\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s). ${counts}` : `\nOK: 0 errors, ${warnings.length} warning(s). ${counts}`);
  process.exit(errors.length ? 1 : 0);
}

#!/usr/bin/env node
// Builds today's digest DETERMINISTICALLY from the data diff, so the report can never disagree with the data.
// Compares the committed version (git ref, default HEAD) with the working tree for:
//   data/atlas.json (people, products, facts), data/events.json, data/glossary.json, data/archive.json
// The only free text comes from pipeline/run/notes.json: { "headline": {ru,en}, "summary": {ru,en}, "reasons": {"<id>": "why removed/changed"} }
// Writes data/digests/<date>.json, updates data/digests/index.json and meta.updatedAt, prints the Russian digest
// (also saved to pipeline/run/digest.md) which is what the person receives as the notification.
// Usage: node scripts/digest.mjs [--date=YYYY-MM-DD] [--base=HEAD] [--print-only]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.ATLAS_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const DATE = args.date || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" }); // the board's day is Tashkent's day
const BASE = args.base || "HEAD";
const SITE = "https://anthropic-atlas.vercel.app";

const readNow = rel => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const readBase = rel => { try { return JSON.parse(execFileSync("git", ["show", `${BASE}:${rel}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { return null; } };
const notesPath = join(ROOT, "pipeline/run/notes.json");
const notesRaw = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, "utf8")) : {};
const notes = notesRaw.date === DATE ? notesRaw : {}; // stale notes from a previous day are ignored
const reasons = notes.reasons || {};

const IGNORED = new Set(["verifiedAt", "avatar", "avatarCredit", "links"]); // enrichment and re-verification are not news
function diff(kind, before = [], after = [], label) {
  const B = new Map(before.map(x => [x.id, x])), A = new Map(after.map(x => [x.id, x]));
  const added = [], updated = [], removed = [], reverified = [];
  for (const [id, a] of A) {
    const b = B.get(id);
    if (!b) { added.push({ kind, id, label: label(a) }); continue; }
    const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !IGNORED.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    const retiredNow = a.status && a.status !== b.status && (["former", "retired"].includes(a.status) || (b.status === "active" && a.status === "legacy"));
    if (retiredNow) { removed.push({ kind, id, label: label(a), reason: reasons[id] || `status → ${a.status}` }); continue; }
    if (fields.length) updated.push({ kind, id, label: label(a), fields, ...(reasons[id] ? { reason: reasons[id] } : {}) });
    else if (a.verifiedAt !== b.verifiedAt) reverified.push(id);
  }
  for (const [id, b] of B) if (!A.has(id)) removed.push({ kind, id, label: label(b), reason: reasons[id] || "removed" });
  return { added, updated, removed, reverified };
}

const atlasNow = readNow("data/atlas.json"), atlasBase = readBase("data/atlas.json") || { people: [], products: [], facts: [] };
const evNow = readNow("data/events.json").events, evBase = (readBase("data/events.json") || { events: [] }).events;
const glNow = existsSync(join(ROOT, "data/glossary.json")) ? readNow("data/glossary.json").terms : [];
const glBase = (readBase("data/glossary.json") || { terms: [] }).terms;
const ru = o => (typeof o === "string" ? o : o?.ru || o?.en || "");

const parts = [
  diff("person", atlasBase.people, atlasNow.people, p => `${p.name} — ${ru(p.role)}`),
  diff("product", atlasBase.products, atlasNow.products, p => p.name),
  diff("fact", atlasBase.facts, atlasNow.facts, f => `${ru(f.label)}: ${f.value}`),
  diff("event", evBase, evNow, e => ru(e.title)),
  diff("fact", glBase, glNow, t => `Термин: ${t.term}`)
];
const pick = k => parts.flatMap(p => p[k]);
const added = pick("added"), updated = pick("updated"), removed = pick("removed"), reverified = pick("reverified");
const newEvents = added.filter(a => a.kind === "event").map(a => a.id);
const nonEventAdded = added.filter(a => a.kind !== "event");

const inboxPath = join(ROOT, "pipeline/inbox/latest.json");
const inbox = existsSync(inboxPath) ? JSON.parse(readFileSync(inboxPath, "utf8")) : { sources: [], items: [] };
const failedSources = inbox.sources.filter(s => !s.ok).map(s => s.id);

const evById = new Map(evNow.map(e => [e.id, e]));
const topNews = newEvents.map(id => evById.get(id)).sort((a, b) => b.importance - a.importance || b.date.localeCompare(a.date));
const autoHeadline = topNews.length ? ru(topNews[0].title) : "Без существенных новостей";
const digest = {
  date: DATE,
  generatedAt: new Date().toISOString(),
  headline: notes.headline || { ru: autoHeadline },
  summary: notes.summary || { ru: topNews.length ? `Новых событий: ${topNews.length}. Добавлено: ${nonEventAdded.length}, изменено: ${updated.length}, убрано как устаревшее: ${removed.length}.` : "Источники проверены, изменений в данных нет." },
  news: newEvents,
  added: nonEventAdded,
  updated,
  removed,
  stats: { sourcesOk: inbox.sources.filter(s => s.ok).length, sourcesFailed: failedSources.length, candidates: inbox.items.length, ...(failedSources.length ? { failedSources } : {}) }
};

// A second run on the same day (re-run, or a late-evening run followed by the morning run) extends the
// existing digest instead of replacing it, so nothing reported earlier that day is lost.
const prevPath = join(ROOT, `data/digests/${DATE}.json`);
if (existsSync(prevPath) && !args.fresh) {
  const prev = JSON.parse(readFileSync(prevPath, "utf8"));
  const union = (a, b) => { const m = new Map(a.map(x => [`${x.kind}:${x.id}`, x])); for (const x of b) m.set(`${x.kind}:${x.id}`, x); return [...m.values()]; };
  digest.news = [...new Set([...prev.news, ...digest.news])].filter(id => evById.has(id));
  digest.added = union(prev.added, digest.added);
  digest.updated = union(prev.updated, digest.updated).filter(u => !digest.added.some(a => a.id === u.id));
  digest.removed = union(prev.removed, digest.removed);
  if (!notes.headline) { digest.headline = prev.headline; digest.summary = prev.summary; }
  newEvents.splice(0, newEvents.length, ...digest.news);
  nonEventAdded.splice(0, nonEventAdded.length, ...digest.added);
  updated.splice(0, updated.length, ...digest.updated);
  removed.splice(0, removed.length, ...digest.removed);
  topNews.splice(0, topNews.length, ...newEvents.map(id => evById.get(id)).sort((a, b) => b.importance - a.importance || b.date.localeCompare(a.date)));
}

const md = [];
md.push(`Anthropic Atlas · ${DATE}`);
md.push(`**${ru(digest.headline)}**`);
md.push(ru(digest.summary));
if (topNews.length) { md.push("\nНовости компании:"); for (const e of topNews.slice(0, 12)) md.push(`• ${ru(e.title)} (${e.date}) — ${e.sources[0].url}`); }
if (topNews.length > 12) md.push(`…и ещё ${topNews.length - 12} — на доске.`);
if (nonEventAdded.length) { md.push("\nДобавлено на доску:"); for (const a of nonEventAdded.slice(0, 15)) md.push(`• ${a.label}`); if (nonEventAdded.length > 15) md.push(`…и ещё ${nonEventAdded.length - 15}`); }
if (updated.length) { md.push("\nОбновлено:"); for (const u of updated.slice(0, 15)) md.push(`• ${u.label} (${u.fields.join(", ")})${u.reason ? ` — ${u.reason}` : ""}`); if (updated.length > 15) md.push(`…и ещё ${updated.length - 15}`); }
if (removed.length) { md.push("\nУстарело и убрано:"); for (const r of removed) md.push(`• ${r.label} — ${r.reason}`); }
if (!topNews.length && !nonEventAdded.length && !updated.length && !removed.length) md.push("\nИзменений нет.");
// New public materials from the library catalog (scripts/library.mjs), with the Russian card title when one exists.
const libPath = join(ROOT, "data/library.json");
if (existsSync(libPath)) {
  const lib = JSON.parse(readFileSync(libPath, "utf8"));
  const notesPath = join(ROOT, "data/library-notes.json");
  const cards = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, "utf8")).notes || {} : {};
  const fresh = lib.items.filter(i => !i.gone && (i.added === DATE || i.date === DATE));
  if (fresh.length) { md.push(`\nНовое в библиотеке (${fresh.length}):`); for (const i of fresh.slice(0, 10)) md.push(`• ${cards[i.id]?.t || i.title} — ${i.url}`); if (fresh.length > 10) md.push(`…и ещё ${fresh.length - 10} — на доске.`); }
}
md.push(`\nПроверено источников: ${digest.stats.sourcesOk}${failedSources.length ? `, недоступны: ${failedSources.join(", ")}` : ""}. Перепроверено записей: ${reverified.length}.`);
md.push(`Доска: ${SITE}`);
const text = md.join("\n");

if (!args["print-only"]) {
  mkdirSync(join(ROOT, "data/digests"), { recursive: true });
  mkdirSync(join(ROOT, "pipeline/run"), { recursive: true });
  writeFileSync(join(ROOT, `data/digests/${DATE}.json`), JSON.stringify(digest, null, 2) + "\n");
  const idxPath = join(ROOT, "data/digests/index.json");
  const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, "utf8")) : { digests: [] };
  idx.digests = [{ date: DATE, headline: digest.headline, counts: { news: newEvents.length, added: nonEventAdded.length, updated: updated.length, removed: removed.length } }, ...idx.digests.filter(d => d.date !== DATE)].sort((a, b) => b.date.localeCompare(a.date));
  writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n");
  atlasNow.meta.updatedAt = DATE;
  writeFileSync(join(ROOT, "data/atlas.json"), JSON.stringify(atlasNow, null, 2) + "\n");
  writeFileSync(join(ROOT, "pipeline/run/digest.md"), text + "\n");
}
console.log(text);

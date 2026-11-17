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
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE)) { console.error(`bad --date ${DATE}: use YYYY-MM-DD`); process.exit(1); }
const SITE = "https://anthropic-atlas.vercel.app";

const readNow = rel => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const readBase = rel => { try { return JSON.parse(execFileSync("git", ["show", `${BASE}:${rel}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); } catch { return null; } };
// optional inputs: a broken or missing file means "no input", never "no digest"
const safe = (rel, dflt) => { try { const p = join(ROOT, rel); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) ?? dflt : dflt; } catch (e) { console.warn(`ignored ${rel}: ${e.message}`); return dflt; } };
const notesRaw = safe("pipeline/run/notes.json", {});
const notes = notesRaw.date === DATE ? notesRaw : {}; // stale notes from a previous day are ignored
const reasons = notes.reasons || {};

const IGNORED = new Set(["verifiedAt", "avatar", "avatarCredit", "links", "label"]); // enrichment and re-verification are not news
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

const inbox = safe("pipeline/inbox/latest.json", {});
inbox.sources = Array.isArray(inbox.sources) ? inbox.sources : []; inbox.items = Array.isArray(inbox.items) ? inbox.items : [];
const failedSources = inbox.sources.filter(s => !s.ok).map(s => s.id);

const evById = new Map(evNow.map(e => [e.id, e]));
// New public materials from the library catalog (scripts/library.mjs, no model), with the Russian card when one exists.
const libCat = safe("data/library.json", { items: [] }); if (!Array.isArray(libCat.items)) libCat.items = [];
const cards = safe("data/library-notes.json", {}).notes || {};
const libTitle = i => cards[i.id]?.t || i.title;
// new today = first seen today, or an official post dated today that the committed catalog did not have yet
const baseLib = new Set(((readBase("data/library.json") || {}).items || []).map(i => i.id));
const fresh = libCat.items.filter(i => !i.gone && (i.added === DATE || (i.date === DATE && !baseLib.has(i.id))));
// the headline counts publications people read; reference pages (docs, help) are listed but do not make news
const notable = i => !/^(docs|help|support|cookbook)/.test(i.section || "");
const freshNews = fresh.filter(i => i.section === "news").sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
const topNews = newEvents.map(id => evById.get(id)).sort((a, b) => b.importance - a.importance || b.date.localeCompare(a.date));
const plural = (n, one, few, many) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many}`;
const QUIET_RU = "Без существенных новостей";
// automatic headline and summary, recomputed from whatever the day holds so far (also on a second run)
function autoText() {
  const lib = digest.library.map(id => libCat.items.find(i => i.id === id)).filter(Boolean);
  const libNews = lib.filter(i => i.section === "news").sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const libNotable = lib.filter(notable);
  if (topNews.length) return {
    headline: { ru: ru(topNews[0].title), en: topNews[0].title.en || ru(topNews[0].title) },
    summary: { ru: `Новых событий: ${topNews.length}. Добавлено: ${nonEventAdded.length}, изменено: ${updated.length}, убрано как устаревшее: ${removed.length}.`, en: `New events: ${topNews.length}. Added: ${nonEventAdded.length}, updated: ${updated.length}, retired: ${removed.length}.` } };
  if (libNews.length) return {
    headline: { ru: libTitle(libNews[0]), en: libNews[0].title },
    summary: { ru: (cards[libNews[0].id]?.s || libNews[0].desc || "Новая публикация Anthropic.") + (lib.length > 1 ? ` Всего новых материалов за день: ${lib.length}.` : ""), en: (libNews[0].desc || "A new Anthropic post.") + (lib.length > 1 ? ` New materials today: ${lib.length}.` : "") } };
  if (libNotable.length) return {
    headline: { ru: `Новое у Anthropic: ${plural(libNotable.length, "публикация", "публикации", "публикаций")}`, en: `New from Anthropic: ${libNotable.length} publication${libNotable.length === 1 ? "" : "s"}` },
    summary: { ru: `${libNotable.slice(0, 3).map(libTitle).join("; ")}.${lib.length > libNotable.length ? ` Обновлений документации и справки: ${lib.length - libNotable.length}.` : ""}`, en: `${libNotable.slice(0, 3).map(i => i.title).join("; ")}.` } };
  if (lib.length) return {
    headline: { ru: `Обновления документации: ${plural(lib.length, "страница", "страницы", "страниц")}`, en: `Documentation updates: ${lib.length} page${lib.length === 1 ? "" : "s"}` },
    summary: { ru: `${lib.slice(0, 3).map(libTitle).join("; ")}.`, en: `${lib.slice(0, 3).map(i => i.title).join("; ")}.` } };
  return { headline: { ru: QUIET_RU, en: "No significant news" }, summary: { ru: "Новых событий и публикаций нет.", en: "No new events or publications." } };
}
const hasRu = o => !!(o && typeof o === "object" && String(o.ru || "").trim());
const digest = {
  date: DATE,
  generatedAt: new Date().toISOString(),
  auto: !hasRu(notes.headline),
  headline: null,
  summary: null,
  news: newEvents,
  library: fresh.map(i => i.id),
  added: nonEventAdded,
  updated,
  removed,
  stats: { sourcesOk: inbox.sources.filter(s => s.ok).length, sourcesFailed: failedSources.length, candidates: inbox.items.length, ...(failedSources.length ? { failedSources } : {}) }
};

// A second run on the same day (re-run, or a late-evening run followed by the morning run) extends the
// existing digest instead of replacing it, so nothing reported earlier that day is lost.
const prevPath = join(ROOT, `data/digests/${DATE}.json`);
const prevRaw = existsSync(prevPath) && !args.fresh ? safe(`data/digests/${DATE}.json`, null) : null;
if (prevRaw && prevRaw.date === DATE) {
  const prev = { news: [], added: [], updated: [], removed: [], library: [], ...prevRaw };
  const union = (a, b) => { const m = new Map(a.map(x => [`${x.kind}:${x.id}`, x])); for (const x of b) m.set(`${x.kind}:${x.id}`, x); return [...m.values()]; };
  digest.news = [...new Set([...prev.news, ...digest.news])].filter(id => evById.has(id));
  digest.added = union(prev.added, digest.added);
  digest.updated = union(prev.updated, digest.updated).filter(u => !digest.added.some(a => a.id === u.id));
  digest.removed = union(prev.removed, digest.removed);
  digest.library = [...new Set([...(prev.library || []), ...digest.library])];
  // keep an earlier hand-written headline; an automatic one is recomputed from the whole day below
  if (digest.auto && prev.auto === false) { digest.auto = false; digest.headline = prev.headline; digest.summary = prev.summary; }
  newEvents.splice(0, newEvents.length, ...digest.news);
  nonEventAdded.splice(0, nonEventAdded.length, ...digest.added);
  updated.splice(0, updated.length, ...digest.updated);
  removed.splice(0, removed.length, ...digest.removed);
  topNews.splice(0, topNews.length, ...newEvents.map(id => evById.get(id)).sort((a, b) => b.importance - a.importance || b.date.localeCompare(a.date)));
}

if (!digest.headline) {
  const a = autoText();
  digest.headline = hasRu(notes.headline) ? notes.headline : a.headline;
  digest.summary = hasRu(notes.summary) ? notes.summary : a.summary;
}
const dayLib = digest.library.map(id => libCat.items.find(i => i.id === id)).filter(Boolean);
const md = [];
md.push(`Anthropic Atlas · ${DATE}`);
md.push(`**${ru(digest.headline)}**`);
md.push(ru(digest.summary));
if (topNews.length) { md.push("\nНовости компании:"); for (const e of topNews.slice(0, 12)) md.push(`• ${ru(e.title)} (${e.date}) — ${e.sources[0].url}`); }
if (topNews.length > 12) md.push(`…и ещё ${topNews.length - 12} — на доске.`);
if (nonEventAdded.length) { md.push("\nДобавлено на доску:"); for (const a of nonEventAdded.slice(0, 15)) md.push(`• ${a.label}`); if (nonEventAdded.length > 15) md.push(`…и ещё ${nonEventAdded.length - 15}`); }
if (updated.length) { md.push("\nОбновлено:"); for (const u of updated.slice(0, 15)) md.push(`• ${u.label} (${u.fields.join(", ")})${u.reason ? ` — ${u.reason}` : ""}`); if (updated.length > 15) md.push(`…и ещё ${updated.length - 15}`); }
if (removed.length) { md.push("\nУстарело и убрано:"); for (const r of removed) md.push(`• ${r.label} — ${r.reason}`); }
if (dayLib.length) { const l = [...dayLib].sort((a, b) => notable(b) - notable(a)); md.push(`\nНовое в библиотеке (${l.length}):`); for (const i of l.slice(0, 10)) md.push(`• ${libTitle(i)} — ${i.url}`); if (l.length > 10) md.push(`…и ещё ${l.length - 10} — на доске.`); }
md.push(`\nАвтоматическая проверка источников: доступны ${digest.stats.sourcesOk}${failedSources.length ? `, недоступны: ${failedSources.join(", ")}` : ""}.${reverified.length ? ` Перепроверено записей: ${reverified.length}.` : ""}`);
md.push(`Доска: ${SITE}`);
const text = md.join("\n");

if (!args["print-only"]) {
  mkdirSync(join(ROOT, "data/digests"), { recursive: true });
  mkdirSync(join(ROOT, "pipeline/run"), { recursive: true });
  writeFileSync(join(ROOT, `data/digests/${DATE}.json`), JSON.stringify(digest, null, 2) + "\n");
  const idxPath = join(ROOT, "data/digests/index.json");
  const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, "utf8")) : { digests: [] };
  idx.digests = [{ date: DATE, headline: digest.headline, counts: { news: newEvents.length, added: nonEventAdded.length, updated: updated.length, removed: removed.length, library: digest.library.length } }, ...idx.digests.filter(d => d.date !== DATE)].sort((a, b) => b.date.localeCompare(a.date));
  writeFileSync(idxPath, JSON.stringify(idx, null, 2) + "\n");
  atlasNow.meta.updatedAt = DATE;
  writeFileSync(join(ROOT, "data/atlas.json"), JSON.stringify(atlasNow, null, 2) + "\n");
  writeFileSync(join(ROOT, "pipeline/run/digest.md"), text + "\n");
  writeFeed(idx);
}
console.log(text);

// RSS feed of the daily digests: anyone can subscribe for free, no account, no bot, no model.
// Quiet days are not items: a subscriber hears only about days when something happened.
function feedXml(idx, readDigest) {
  const x = s => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  const busy = d => Object.values(d.counts || {}).some(n => n > 0);
  const items = idx.digests.filter(busy).slice(0, 30).map(d => {
    const dj = readDigest(d.date) || {};
    const when = dj.generatedAt && !isNaN(new Date(dj.generatedAt)) ? new Date(dj.generatedAt) : new Date(d.date + "T00:40:00Z");
    return `<item><title>${x(d.date)} · ${x(ru(d.headline))}</title><link>${SITE}/</link><guid isPermaLink="false">atlas-digest-${x(d.date)}</guid><pubDate>${when.toUTCString()}</pubDate><description>${x(ru(dj.summary))}</description></item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Anthropic Atlas</title><link>${SITE}/</link><atom:link href="${SITE}/data/feed.xml" rel="self" type="application/rss+xml"/><description>Ежедневная сводка об Anthropic по открытым источникам</description><language>ru</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n${items}\n</channel></rss>\n`;
}
function writeFeed(idx) {
  writeFileSync(join(ROOT, "data/feed.xml"), feedXml(idx, date => safe(`data/digests/${date}.json`, null)));
}

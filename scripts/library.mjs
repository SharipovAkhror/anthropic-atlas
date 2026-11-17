#!/usr/bin/env node
// Library catalog: every public material Anthropic publishes, as one card each
// (title, short description, date, section, audience, link to the original).
// Deterministic, no LLM. Reads public sitemaps and llms.txt indexes, fetches page metadata only
// for URLs it has not seen before, and writes data/library.json.
// Human/agent-written Russian summaries live separately in data/library-notes.json and never
// block this script: if they are missing, the site shows the original description.
// Safety: an item that disappears from its source is kept and marked `gone`, never deleted,
// and the run refuses to write if a source suddenly returns far fewer items than before.
// Usage: node scripts/library.mjs [--max=400] [--dry] [--offline]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const MAX_FETCH = +(args.max || 400);
const TODAY = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
const OUT = join(ROOT, "data/library.json");
const UA = JSON.parse(readFileSync(join(ROOT, "sources/sources.json"), "utf8")).userAgent;

export const SECTIONS = [
  { id: "research", ru: "Исследования", en: "Research", uz: "Tadqiqotlar" },
  { id: "engineering", ru: "Инженерный блог", en: "Engineering", uz: "Muhandislik blogi" },
  { id: "news", ru: "Новости и анонсы", en: "News", uz: "Yangiliklar" },
  { id: "policy", ru: "Политики и безопасность", en: "Policies & safety", uz: "Siyosat va xavfsizlik" },
  { id: "institute", ru: "Экономика и общество", en: "Economy & society", uz: "Iqtisod va jamiyat" },
  { id: "models", ru: "Модели и продукты", en: "Models & products", uz: "Modellar va mahsulotlar" },
  { id: "guides", ru: "Статьи и гайды", en: "Articles & guides", uz: "Maqolalar va qo‘llanmalar" },
  { id: "talks", ru: "Вебинары и доклады", en: "Webinars & talks", uz: "Vebinarlar" },
  { id: "customers", ru: "Истории клиентов", en: "Customer stories", uz: "Mijozlar tajribasi" },
  { id: "docs-code", ru: "Документация Claude Code", en: "Claude Code docs", uz: "Claude Code hujjatlari" },
  { id: "docs-api", ru: "Документация API", en: "API docs", uz: "API hujjatlari" },
  { id: "events", ru: "События", en: "Events", uz: "Tadbirlar" }
];
// Default audience per section; library-notes.json can override per item.
export const WHO = {
  research: ["researchers"], engineering: ["developers"], news: ["everyone"], policy: ["policy", "researchers"],
  institute: ["policy", "business"], models: ["everyone"], guides: ["learners", "business"], talks: ["learners", "developers"],
  customers: ["business"], "docs-code": ["developers"], "docs-api": ["developers"], events: ["everyone"]
};

const sha = s => createHash("sha1").update(s).digest("hex").slice(0, 10);
const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();
const norm = u => u.replace(/\.md$/, "").replace(/\/$/, "").replace(/^http:/, "https:");
const slugTitle = u => { const s = decodeURIComponent(new URL(u).pathname.split("/").filter(Boolean).pop() || ""); return s.replace(/[-_]+/g, " ").replace(/^./, c => c.toUpperCase()); };

async function get(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 1200 * (i + 1))); }
  }
  throw new Error(`${url}: ${last?.message}`);
}
const locs = xml => [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => ({ loc: decode((m[1].match(/<loc>([\s\S]*?)<\/loc>/) || [])[1]), lastmod: ((m[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/) || [])[1] || "").slice(0, 10) || null }));

// ---- classifiers: URL → section (null = not a library item)
const POLICY = /^\/(responsible-scaling-policy|constitution|transparency|system-cards|policy|coordinated-vulnerability-disclosure|responsible-disclosure-policy|threat-intelligence|news\/claudes-constitution)/;
function classifyAnthropic(path) {
  if (/^\/research\/team\//.test(path) || path === "/research" || path === "/news" || path === "/engineering") return null;
  if (path.startsWith("/research/")) return "research";
  if (path.startsWith("/news/")) return "news";
  if (path.startsWith("/events/")) return "events";
  if (/^\/(institute\/|economic-index|economic-futures\/)/.test(path)) return "institute";
  if (POLICY.test(path)) return "policy";
  if (/^\/(claude-(opus|sonnet|haiku|fable)|claude\/[a-z]|features\/)/.test(path)) return "models";
  return null;
}
function classifyClaude(path) {
  if (/^\/resources\/(articles|guides)\/./.test(path)) return "guides";
  if (/^\/resources\/(webinars|webinar-series)\/./.test(path) || /^\/code-with-claude\/session\/./.test(path)) return "talks";
  if (/^\/customers\/./.test(path)) return "customers";
  if (/^\/product\/./.test(path)) return "models";
  return null;
}

// ---- sources. Each returns [{url, section, title?, desc?, date?, group?}]
const SOURCES = [
  { id: "anthropic", min: 300, async run() {
      const xml = await get("https://www.anthropic.com/sitemap.xml");
      let eng = new Set(), teams = {}, engOk = false, teamsOk = true;
      try { eng = new Set([...(await get("https://www.anthropic.com/engineering")).matchAll(/href="\/research\/([a-z0-9-]+)"/gi)].map(m => m[1].toLowerCase())); engOk = eng.size > 5; } catch {}
      for (const t of ["interpretability", "alignment", "societal-impacts", "frontier-red-team", "economics"]) {
        try { for (const m of (await get(`https://www.anthropic.com/research/team/${t}`)).matchAll(/href="\/research\/([a-z0-9-]+)"/gi)) (teams[m[1].toLowerCase()] ||= []).includes(t) || teams[m[1].toLowerCase()].push(t); } catch { teamsOk = false; }
      }
      return locs(xml).map(({ loc, lastmod }) => {
        const path = new URL(loc).pathname.replace(/\/$/, "");
        let section = classifyAnthropic(path);
        const slug = path.split("/").pop().toLowerCase();
        if (section === "research" && eng.has(slug)) section = "engineering";
        return section && { url: norm(loc), section, lastmod, team: teams[slug], keepSection: !engOk && section === "research", keepTeam: !teamsOk };
      }).filter(Boolean);
  } },
  { id: "claude", min: 300, async run() {
      const xml = await get("https://claude.com/sitemap.xml");
      return locs(xml).map(({ loc, lastmod }) => { const s = classifyClaude(new URL(loc).pathname.replace(/\/$/, "")); return s && { url: norm(loc), section: s, lastmod }; }).filter(Boolean);
  } },
  { id: "docs-code", min: 100, async run() { return llms(await get("https://code.claude.com/docs/llms.txt"), "docs-code"); } },
  { id: "docs-api", min: 100, async run() { return llms(await get("https://docs.claude.com/llms.txt"), "docs-api"); } }
];
// llms.txt: "- [Title](url.md): description" (or " - description"); groups from ### / #### headings.
// For the API docs only the English part is used and the per-endpoint "API Reference" is skipped.
function llms(txt, section) {
  const out = []; let group = "", h2 = "", skip = false;
  for (const line of txt.split("\n")) {
    if (line.startsWith("## ")) { h2 = line.slice(3).trim(); continue; }
    if (/^#{3,4} /.test(line)) { group = line.replace(/^#+ /, "").trim(); skip = section === "docs-api" && (h2 !== "English" || /^(API Reference|Other pages)$/.test(group)); continue; }
    if (skip || (section === "docs-api" && h2 !== "English")) continue;
    const m = line.match(/^\s*- \[([^\]]+)\]\((https?:[^)]+)\)\s*(?::|-)?\s*(.*)$/);
    if (m && /\/en\//.test(m[2])) out.push({ url: norm(m[2]), section, title: decode(m[1]), desc: decode(m[3]), group });
  }
  return out;
}

async function meta(url) {
  const html = await get(url, 2);
  if (/just a moment|access denied|attention required|page not found/i.test((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "")) throw new Error("challenge or error page");
  const m = n => decode((html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=(["'])(.*?)\\1`, "i")) || [])[2] || (html.match(new RegExp(`<meta[^>]+content=(["'])(.*?)\\1[^>]*(?:property|name)=["']${n}["']`, "i")) || [])[2]);
  const title = (m("og:title") || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1])).replace(/\s*[|\\–—-]\s*(Anthropic|Claude)\s*$/i, "").slice(0, 220);
  const date = (m("article:published_time") || (html.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1] || "").slice(0, 10) || null;
  if (!title) throw new Error("no title");
  return { title, desc: (m("og:description") || m("description")).slice(0, 420), date };
}

async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

async function main() {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { items: [] };
  const byUrl = new Map(prev.items.map(it => [it.url, it]));
  const report = { sources: {}, added: [], gone: [], fetched: 0, fetchFailed: 0 };
  const seenNow = new Set();
  const sourceOk = new Set();
  for (const src of SOURCES) {
    let rows;
    try { rows = args.offline ? [] : await src.run(); } catch (e) { report.sources[src.id] = `error: ${e.message}`; continue; }
    const before = prev.items.filter(it => it.src === src.id && !it.gone).length;
    // A source that suddenly shrinks is broken (blocked, redesigned), not emptied: keep the old items.
    if (rows.length < src.min || (before > 50 && rows.length < before * 0.9)) { report.sources[src.id] = `suspicious: ${rows.length} rows (had ${before}), kept previous`; continue; }
    report.sources[src.id] = rows.length; sourceOk.add(src.id);
    for (const r of rows) {
      seenNow.add(r.url);
      const old = byUrl.get(r.url);
      const it = old || { id: sha(r.url), url: r.url, src: src.id, added: prev.items.length ? TODAY : null };
      it.section = r.keepSection && old ? old.section : r.section; it.src = src.id;
      if (r.title) it.title = r.title;
      if (r.desc) it.desc = r.desc;
      if (r.group) it.group = r.group;
      if (!r.keepTeam) { if (r.team?.length) it.team = r.team; else delete it.team; }
      if (r.lastmod) it.lastmod = r.lastmod;
      delete it.gone;
      if (!old) { byUrl.set(r.url, it); report.added.push(r.url); }
    }
  }
  for (const it of byUrl.values()) if (sourceOk.has(it.src) && !seenNow.has(it.url) && !it.gone) { it.gone = TODAY; report.gone.push(it.url); }

  // Page metadata only for items that lack it (new or never fetched), newest-first by lastmod, capped per run.
  const need = [...byUrl.values()].filter(it => !it.gone && !it.metaAt && (it.src === "anthropic" || it.src === "claude"))
    .sort((a, b) => String(b.lastmod).localeCompare(String(a.lastmod))).slice(0, MAX_FETCH);
  const deadline = Date.now() + 6 * 60e3; // the collector has a time budget; unfinished items are fetched tomorrow
  await pool(need, 8, async it => {
    if (Date.now() > deadline) return;
    try { const m = await meta(it.url); if (m.title) it.title = m.title; if (m.desc) it.desc = m.desc; if (m.date) it.date = m.date; it.metaAt = TODAY; report.fetched++; }
    catch { report.fetchFailed++; }
  });
  for (const it of byUrl.values()) if (!it.title) it.title = slugTitle(it.url);

  const items = [...byUrl.values()].sort((a, b) => String(b.date || b.added || "").localeCompare(String(a.date || a.added || "")) || a.url.localeCompare(b.url))
    .map(({ id, url, src, section, title, desc, date, added, lastmod, group, team, gone, metaAt }) => Object.fromEntries(Object.entries({ id, url, src, section, title, desc, date, added, lastmod, group, team, gone, metaAt }).filter(([, v]) => v != null && v !== "")));
  const out = { updated: TODAY, sections: SECTIONS, who: WHO, items };
  const live = items.filter(i => !i.gone).length;
  console.log(JSON.stringify({ ...report, added: report.added.length, gone: report.gone.length, total: items.length, live }, null, 1));
  if (!args.dry) writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/},{"id"/g, '},\n{"id"') + "\n");
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });

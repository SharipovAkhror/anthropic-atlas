#!/usr/bin/env node
// Library catalog: every public material Anthropic publishes, as one card each
// (title, short description, date, section, audience, link to the original).
// Deterministic, no LLM. Reads public sitemaps and llms.txt indexes, fetches page metadata only
// for URLs it has not seen before, and writes data/library.json.
// Human/agent-written Russian summaries live separately in data/library-notes.json and never
// block this script: if they are missing, the site shows the original description.
// Safety: an item that disappears from its source is kept and marked `gone`, never deleted,
// and the run refuses to write if a source suddenly returns far fewer items than before.
// Sources: anthropic.com and claude.com sitemaps, Claude Code / API / MCP llms.txt, Anthropic Academy (Skilljar)
// and the courses repo, the Claude Cookbook registry, the Alignment Science blog, Transformer Circuits, the Help Center.
// (red.anthropic.com redirects to anthropic.com/research/team/frontier-red-team, already covered by the sitemap.)
// Usage: node scripts/library.mjs [--max=400] [--dry] [--offline] [--only=help,cookbook]
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
  { id: "events", ru: "События", en: "Events", uz: "Tadbirlar" },
  { id: "courses", ru: "Курсы и Академия", en: "Courses & Academy", uz: "Kurslar va Akademiya" },
  { id: "cookbook", ru: "Рецепты кода (Cookbook)", en: "Claude Cookbook", uz: "Kod retseptlari (Cookbook)" },
  { id: "help", ru: "Справочный центр", en: "Help Center", uz: "Yordam markazi" },
  { id: "docs-mcp", ru: "Документация MCP", en: "MCP docs", uz: "MCP hujjatlari" }
];
// Default audience per section; library-notes.json can override per item.
export const WHO = {
  research: ["researchers"], engineering: ["developers"], news: ["everyone"], policy: ["policy", "researchers"],
  institute: ["policy", "business"], models: ["everyone"], guides: ["learners", "business"], talks: ["learners", "developers"],
  customers: ["business"], "docs-code": ["developers"], "docs-api": ["developers"], events: ["everyone"],
  courses: ["learners", "developers"], cookbook: ["developers"], help: ["everyone"], "docs-mcp": ["developers"]
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
  { id: "docs-api", min: 100, async run() { return llms(await get("https://docs.claude.com/llms.txt"), "docs-api"); } },
  // Anthropic Academy (Skilljar catalog) + the open courses repo on GitHub.
  { id: "courses", min: 8, async run() {
      const out = [];
      let academyOk = false, ghOk = false;
      try {
        const rows = skilljar(await get("https://anthropic.skilljar.com/"));
        out.push(...rows); academyOk = rows.length >= 5;
      } catch {}
      try {
        const rows = githubCourses(await get("https://raw.githubusercontent.com/anthropics/courses/master/README.md"));
        out.push(...rows); ghOk = rows.length >= 3;
      } catch {}
      // Half a source must not mark the other half `gone`: both halves or nothing.
      if (!academyOk || !ghOk) throw new Error(`partial: academy ${academyOk}, github ${ghOk}`);
      return out;
  } },
  // Claude Cookbook: registry.yaml is the machine-readable list behind the cookbook site (title, description, date, categories).
  { id: "cookbook", min: 30, async run() { return cookbook(await get("https://raw.githubusercontent.com/anthropics/claude-cookbooks/main/registry.yaml")); } },
  // Alignment Science blog: an index page of "Month YYYY" headings followed by post cards.
  { id: "alignment", min: 20, async run() { return monthIndex(await get("https://alignment.anthropic.com/"), "https://alignment.anthropic.com/", { section: "research", team: ["alignment"] }); } },
  // Transformer Circuits thread (interpretability team): same shape as the alignment blog.
  { id: "circuits", min: 20, async run() { return monthIndex(await get("https://transformer-circuits.pub/"), "https://transformer-circuits.pub/", { section: "research", team: ["interpretability"] }); } },
  // Claude Help Center: English articles from the sitemap; titles and collections from the navigation tree on the home page.
  { id: "help", min: 200, async run() {
      const [xml, home] = await Promise.all([get("https://support.claude.com/sitemap.xml"), get("https://support.claude.com/en").catch(() => "")]);
      return helpCenter(xml, home);
  } },
  // Model Context Protocol docs (llms.txt lists every page once per protocol version: keep the newest released one).
  { id: "docs-mcp", min: 60, async run() { return mcpDocs(await get("https://modelcontextprotocol.io/llms.txt")); } }
];

// ---- parsers for the sources above (exported for scripts/test.mjs; each returns rows and never fetches)
const strip = s => decode(String(s || "").replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const notFuture = d => d && d <= TODAY ? d : null;
const clip = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s;
const unq = v => { v = String(v ?? "").trim(); if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'"); if (/^".*"$/.test(v)) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } } return v; };

// A card (<a>…</a>) → title and description. Prefers explicit markup (heading, class*=title / desc), then text blocks.
function card(inner) {
  const byClass = re => { const m = inner.match(new RegExp(`<(\\w+)[^>]*class=["'][^"']*(?:${re})[^"']*["'][^>]*>([\\s\\S]*?)</\\1>`, "i")); return m ? strip(m[2]) : ""; };
  const blocks = inner.split(/<\/?(?:h[1-6]|div|p|br|li|span|strong|b|em|i|time)\b[^>]*>/i).map(strip).filter(Boolean);
  const title = strip((inner.match(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/i) || [])[2]) || byClass("title|coursebox-text(?![\\w-])|name") || strip((inner.match(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i) || [])[2]) || blocks[0] || "";
  let desc = byClass("desc|summary|abstract|blurb|excerpt");
  if (!desc && blocks.length > 1) { const last = blocks[blocks.length - 1]; if (last !== title && last.length > 25) desc = last; }
  return { title: clip(title, 220), desc: clip(desc, 420) };
}

// Index pages of the form: "November 2026" heading, then the posts of that month as <a> cards.
// Only links on the same host with a /YYYY/ path count; links to anthropic.com or arXiv are skipped
// (anthropic.com items come from the main sitemap, external papers are not Anthropic pages).
export function monthIndex(html, base, { section, team }) {
  const host = new URL(base).host, out = [], seen = new Set();
  let date = null;
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>|<(h[1-6]|div|p|span|time|li|dt|strong|b)\b[^>]*>([^<]{6,60})<\/\3>/gi;
  for (const m of String(html).matchAll(re)) {
    if (m[3]) {
      const ms = [...strip(m[4]).toLowerCase().matchAll(new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{4})\\b`, "g"))];
      if (ms.length && /^[a-z]+\s+\d{4}(\s*[-–—]\s*[a-z]+\s+\d{4})?$/.test(strip(m[4]).toLowerCase())) { const [, mon, y] = ms[ms.length - 1]; date = `${y}-${String(MONTHS.indexOf(mon) + 1).padStart(2, "0")}-01`; }
      continue;
    }
    const href = (m[1].match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href || href.startsWith("#")) continue;
    let u; try { u = new URL(decode(href), base); } catch { continue; }
    if (u.host !== host || !/^\/20\d\d\/[^/]+/.test(u.pathname)) continue;
    u.hash = ""; u.search = "";
    const url = norm(u.href);
    if (seen.has(url)) continue;
    const { title, desc } = card(m[2]);
    if (!title) continue;
    seen.add(url);
    // The month heading is the only date on the page; the year in the URL is a sanity check.
    const y = u.pathname.slice(1, 5);
    out.push({ url, section, title, desc, date: notFuture(date && date.slice(0, 4) === y ? date : null), team });
  }
  return out;
}

// Skilljar catalog: course cards are links to /<course-slug> (class "coursebox-container" on the live site).
export function skilljar(html) {
  const out = [], seen = new Set();
  for (const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1], href = (attrs.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href || !/coursebox|course-card|catalog-item/i.test(attrs + m[2].slice(0, 400))) continue;
    let u; try { u = new URL(decode(href), "https://anthropic.skilljar.com/"); } catch { continue; }
    if (u.host !== "anthropic.skilljar.com" || !/^\/[a-z0-9][a-z0-9-]*\/?$/i.test(u.pathname) || /^\/(auth|accounts|page|catalog|search|login|signup)\b/i.test(u.pathname)) continue;
    const url = norm(u.origin + u.pathname);
    const { title, desc } = card(m[2]);
    if (!title || seen.has(url)) continue;
    seen.add(url); out.push({ url, section: "courses", title, desc, group: "Anthropic Academy" });
  }
  return out;
}

// github.com/anthropics/courses README: "1. [Title](./folder/README.md) - description".
export function githubCourses(md) {
  const out = [];
  for (const m of String(md).matchAll(/^\s*\d+\.\s+\[([^\]]+)\]\(\.\/([A-Za-z0-9_-]+)\/?[^)]*\)\s*[-–—:]?\s*(.*)$/gm))
    out.push({ url: `https://github.com/anthropics/courses/tree/master/${m[2]}`, section: "courses", title: m[1].trim(), desc: clip(m[3].replace(/\[\[[^\]]*\]\([^)]*\)\]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim(), 420), group: "GitHub: anthropics/courses" });
  return out;
}

// Minimal reader for registry.yaml (a flat list of maps; values are scalars, folded scalars or lists of scalars).
export function cookbook(yaml) {
  const recs = []; let cur = null, key = null;
  for (const line of String(yaml).split("\n")) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    let m;
    if ((m = line.match(/^- ([\w-]+):\s*(.*)$/))) { cur = {}; recs.push(cur); key = m[1]; cur[key] = m[2]; continue; }
    if (!cur) continue;
    if ((m = line.match(/^  ([\w-]+):\s*(.*)$/))) { key = m[1]; cur[key] = /^[>|][-+]?$/.test(m[2]) ? "" : m[2]; continue; }
    if ((m = line.match(/^\s+- (.*)$/))) { if (!Array.isArray(cur[key])) cur[key] = []; cur[key].push(unq(m[1])); continue; }
    if ((m = line.match(/^\s{3,}(\S.*)$/)) && typeof cur[key] === "string") cur[key] = `${cur[key]} ${m[1].trim()}`.trim();
  }
  return recs.map(r => {
    const path = unq(r.path), title = unq(r.title);
    if (!path || !title || /\.\.|^\//.test(path)) return null;
    const cats = Array.isArray(r.categories) ? r.categories : [];
    return { url: `https://github.com/anthropics/claude-cookbooks/blob/main/${path.split("/").map(encodeURIComponent).join("/")}`, section: "cookbook", title: clip(title, 220), desc: clip(unq(r.description).replace(/\s+/g, " "), 420), date: notFuture(/^\d{4}-\d{2}-\d{2}$/.test(unq(r.date)) ? unq(r.date) : null), group: cats[0] || "" };
  }).filter(Boolean);
}

// Help Center: the sitemap lists every article in 12 languages; only /en/articles/ is kept.
// The home page embeds the navigation tree (collections → subcollections → articles) in __NEXT_DATA__.
export function helpCenter(xml, homeHtml) {
  const nav = new Map();
  try {
    const j = JSON.parse((String(homeHtml).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/) || [])[1]);
    const walk = (c, top) => { for (const a of c.articles || []) if (a.url && !nav.has(norm(a.url))) nav.set(norm(a.url), { title: a.title, group: top }); for (const s of c.subcollections || []) walk(s, top); };
    for (const c of j?.props?.pageProps?.v2Navbar?.collections || []) walk(c, c.name);
  } catch {}
  const out = [], seen = new Set();
  for (const { loc, lastmod } of locs(xml)) {
    if (!/^https:\/\/support\.claude\.com\/en\/articles\/\d+/.test(loc || "")) continue;
    const url = norm(loc);
    if (seen.has(url)) continue;
    seen.add(url);
    const n = nav.get(url);
    const slug = decodeURIComponent(url.split("/").pop()).replace(/^\d+-?/, "").replace(/-+/g, " ");
    out.push({ url, section: "help", title: clip(n?.title || slug.replace(/^./, c => c.toUpperCase()) || "Help article", 220), group: n?.group || "", lastmod: notFuture(lastmod) });
  }
  return out;
}

// modelcontextprotocol.io/llms.txt: "- [Title](url.md): description", every docs/spec page repeated per version
// (/docs/2025-11-25/…, /specification/draft/…). Keeps the newest dated version that is not in the future, plus unversioned pages.
export function mcpDocs(txt) {
  const rows = [];
  for (const line of String(txt).split("\n")) {
    const m = line.match(/^\s*- \[([^\]]+)\]\((https:\/\/modelcontextprotocol\.io\/[^)\s]+)\)\s*(?::\s*(.*))?$/);
    if (m) rows.push({ title: decode(m[1]), url: m[2], desc: decode(m[3] || "") });
  }
  const ver = u => (u.match(/\/(?:docs|specification)\/(\d{4}-\d{2}-\d{2}|draft|latest)\//) || [])[1];
  const latest = rows.map(r => ver(r.url)).filter(v => v && /^\d/.test(v) && v <= TODAY).sort().pop();
  const out = [], seen = new Set();
  for (const r of rows) {
    const v = ver(r.url);
    if (v && v !== latest) continue;
    const url = norm(r.url);
    if (seen.has(url)) continue;
    seen.add(url);
    const seg = new URL(url).pathname.split("/").filter(Boolean)[0] || "";
    const group = { docs: "Docs", specification: "Specification", seps: "SEPs", sep: "SEPs" }[seg.toLowerCase()] || (seg.length > 2 ? seg.replace(/[-_]+/g, " ").replace(/^./, c => c.toUpperCase()) : "MCP");
    out.push({ url, section: "docs-mcp", title: clip(r.title, 220), desc: clip(r.desc, 420), group });
  }
  return out;
}
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
    if (args.only && !String(args.only).split(",").includes(src.id)) continue;
    try { rows = args.offline ? [] : await src.run(); } catch (e) { report.sources[src.id] = `error: ${e.message}`; continue; }
    const before = prev.items.filter(it => it.src === src.id && !it.gone).length;
    // A source that suddenly shrinks is broken (blocked, redesigned), not emptied: keep the old items.
    if (rows.length < src.min || (before > 50 && rows.length < before * 0.9)) { report.sources[src.id] = `suspicious: ${rows.length} rows (had ${before}), kept previous`; continue; }
    report.sources[src.id] = rows.length; sourceOk.add(src.id);
    // The first successful run of a new source is a bootstrap, not news: its items get no `added` date,
    // so hundreds of old help articles do not flood "New in the library".
    const known = prev.items.some(it => it.src === src.id);
    for (const r of rows) {
      if (seenNow.has(r.url)) continue; // listed twice (or by an earlier source): the first one wins
      seenNow.add(r.url);
      const old = byUrl.get(r.url);
      const it = old || { id: sha(r.url), url: r.url, src: src.id, added: prev.items.length && known ? TODAY : null };
      it.section = r.keepSection && old ? old.section : r.section; it.src = src.id;
      if (r.title) it.title = r.title;
      if (r.desc) it.desc = r.desc;
      if (r.group) it.group = r.group;
      if (!r.keepTeam) { if (r.team?.length) it.team = r.team; else delete it.team; }
      if (r.lastmod && r.lastmod <= TODAY) it.lastmod = r.lastmod;
      if (r.date && r.date <= TODAY && !it.metaAt) it.date = r.date;
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

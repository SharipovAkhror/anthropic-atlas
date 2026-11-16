#!/usr/bin/env node
// Daily collector. Deterministic, no LLM. Reads sources/sources.json, fetches every source,
// and writes what is NEW since the previous run to pipeline/inbox/<date>.json (+ latest.json).
// State lives in pipeline/state.json and pipeline/pages/*.txt so every run is diffable in git.
// A source that has never been seen before is "baselined": its current items are recorded as seen
// and not reported, so adding a source never floods the inbox.
// Usage: node scripts/collect.mjs [--date=YYYY-MM-DD] [--only=id1,id2] [--dry]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const DATE = args.date || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" }); // the board's day is Tashkent's day
const NOW = Date.now();
const reg = JSON.parse(readFileSync(join(ROOT, "sources/sources.json"), "utf8"));
const only = args.only ? new Set(String(args.only).split(",")) : null;
const statePath = join(ROOT, "pipeline/state.json");
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { seen: {}, cursors: {} };
state.seen ||= {}; state.cursors ||= {};
mkdirSync(join(ROOT, "pipeline/pages"), { recursive: true });
mkdirSync(join(ROOT, "pipeline/inbox"), { recursive: true });

const sha = s => createHash("sha1").update(s).digest("hex").slice(0, 12);
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const strip = html => decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")).split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? decode(m[1]).trim() : ""; };

async function get(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": reg.userAgent, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
  throw last;
}

async function pageMeta(url) {
  try {
    const html = await get(url, 2);
    const meta = n => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]+content=["']([^"']*)`, "i")) || [])[1];
    return {
      title: decode(meta("og:title") || tag(html, "title")).slice(0, 200),
      snippet: decode(meta("og:description") || meta("description") || "").slice(0, 400),
      published: meta("article:published_time") || (html.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1] || null
    };
  } catch { return { title: "", snippet: "", published: null }; }
}

const handlers = {
  async sitemap(src, baseline) {
    const xml = await get(src.url);
    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => ({ loc: tag(m[1], "loc"), lastmod: tag(m[1], "lastmod") }))
      .filter(u => !src.include || src.include.some(p => new URL(u.loc).pathname.startsWith(p)));
    const fresh = urls.filter(u => !state.seen[sha(u.loc)]);
    fresh.forEach(u => (state.seen[sha(u.loc)] = DATE));
    if (baseline) return [];
    const out = [];
    for (const u of fresh.slice(0, 25)) out.push({ url: u.loc, lastmod: u.lastmod || null, ...(await pageMeta(u.loc)) });
    return out;
  },
  async rss(src, baseline) {
    const xml = await get(src.url);
    const blocks = [...xml.matchAll(/<(item|entry)>([\s\S]*?)<\/\1>/g)].map(m => m[2]);
    const maxAge = (src.maxAgeDays || 3) * 864e5;
    const items = blocks.map(b => {
      const link = tag(b, "link") || (b.match(/<link[^>]+href="([^"]+)"/) || [])[1] || "";
      const pub = tag(b, "pubDate") || tag(b, "updated") || tag(b, "published");
      return { url: decode(link), title: tag(b, "title").slice(0, 240), snippet: strip(tag(b, "description") || tag(b, "summary")).join(" ").slice(0, 400), published: pub ? new Date(pub).toISOString() : null, outlet: tag(b, "source") || null };
    }).filter(i => i.url && (!i.published || NOW - Date.parse(i.published) < maxAge));
    const fresh = items.filter(i => !state.seen[sha(i.url)] && !state.seen[sha(i.title)]);
    fresh.forEach(i => { state.seen[sha(i.url)] = DATE; state.seen[sha(i.title)] = DATE; });
    return baseline ? [] : fresh.slice(0, src.max || 40);
  },
  async "dated-headings"(src, baseline) {
    const lines = strip(await get(src.url));
    const re = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d{2}$/;
    const byDate = new Map();
    let cur = null;
    for (const l of lines) {
      if (re.test(l)) { const d = new Date(l + " UTC").toISOString().slice(0, 10); if (!byDate.has(d)) byDate.set(d, { date: d, text: [] }); cur = byDate.get(d); }
      else if (cur && !cur.text.includes(l)) cur.text.push(l);
    }
    const sections = [...byDate.values()];
    const cursor = state.cursors[src.id];
    const newest = sections.map(s => s.date).sort().at(-1);
    if (newest) state.cursors[src.id] = newest > (cursor || "") ? newest : cursor;
    if (baseline || !cursor) return [];
    return sections.filter(s => s.date > cursor).slice(0, 10).map(s => ({ url: src.url, title: `${src.name}: ${s.date}`, published: s.date, snippet: s.text.join(" · ").slice(0, 1500) }));
  },
  async "changelog-md"(src, baseline) {
    const md = await get(src.url);
    const parts = md.split(/^## /m).slice(1).map(p => ({ version: p.split("\n")[0].trim(), body: p.split("\n").slice(1).filter(l => l.startsWith("- ")).slice(0, 8).join("\n") }));
    const cursor = state.cursors[src.id];
    if (parts[0]) state.cursors[src.id] = parts[0].version;
    if (baseline || !cursor) return [];
    const idx = parts.findIndex(p => p.version === cursor);
    const fresh = idx === -1 ? parts.slice(0, 5) : parts.slice(0, idx);
    if (!fresh.length) return [];
    return [{ url: "https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md", title: `Claude Code ${fresh.at(-1).version} → ${fresh[0].version}`, published: DATE, snippet: fresh.map(p => `${p.version}\n${p.body}`).join("\n").slice(0, 2500) }];
  },
  async "page-watch"(src) {
    const NOISE = /cookie|consent|skip to main|accept all|reject all|customi[sz]e|privacy choices|©|copyright|log in|sign up/i;
    const lines = strip(await get(src.url)).filter(l => l.length > 2 && l.length < 400 && !NOISE.test(l));
    const file = join(ROOT, "pipeline/pages", `${src.id}.txt`);
    const prev = existsSync(file) ? readFileSync(file, "utf8").split("\n") : null;
    writeFileSync(file, lines.join("\n") + "\n");
    if (!prev) return [];
    const P = new Set(prev), N = new Set(lines);
    const added = lines.filter(l => !P.has(l)), removed = prev.filter(l => l && !N.has(l));
    if (!added.length && !removed.length) return [];
    return [{ url: src.url, title: `Page changed: ${src.name}`, published: DATE, added: added.slice(0, 40), removed: removed.slice(0, 40) }];
  }
};

const report = { date: DATE, generatedAt: new Date().toISOString(), sources: [], items: [] };
for (const src of reg.sources) {
  if (only && !only.has(src.id)) continue;
  const baseline = !state.cursors[`init:${src.id}`];
  try {
    const items = await handlers[src.kind](src, baseline);
    state.cursors[`init:${src.id}`] = state.cursors[`init:${src.id}`] || DATE;
    report.sources.push({ id: src.id, ok: true, baseline, count: items.length });
    for (const it of items) report.items.push({ id: sha(it.url + (it.title || "")), source: src.id, tier: src.tier, kind: src.kind, ...it });
    console.log(`ok    ${src.id}${baseline ? " (baseline)" : ""}: ${items.length} new`);
  } catch (e) {
    report.sources.push({ id: src.id, ok: false, error: String(e.message || e).slice(0, 200) });
    console.log(`FAIL  ${src.id}: ${e.message}`);
  }
}

// prune memory older than 180 days, keep inbox for 21 days
const cutoff = new Date(NOW - 180 * 864e5).toISOString().slice(0, 10);
for (const [k, v] of Object.entries(state.seen)) if (v < cutoff) delete state.seen[k];
if (!args.dry) {
  writeFileSync(statePath, JSON.stringify(state, null, 0) + "\n");
  const body = JSON.stringify(report, null, 2) + "\n";
  writeFileSync(join(ROOT, "pipeline/inbox", `${DATE}.json`), body);
  writeFileSync(join(ROOT, "pipeline/inbox/latest.json"), body);
  const keep = new Date(NOW - 21 * 864e5).toISOString().slice(0, 10);
  for (const f of readdirSync(join(ROOT, "pipeline/inbox"))) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < keep) unlinkSync(join(ROOT, "pipeline/inbox", f));
}
const failed = report.sources.filter(s => !s.ok).length;
console.log(`\n${report.items.length} new item(s); ${report.sources.length - failed} source(s) ok, ${failed} failed.`);

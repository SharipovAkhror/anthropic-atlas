#!/usr/bin/env node
// Free translation layer, so Russian and Uzbek work on their own without the optional Claude run.
//   * Uzbek (Latin script) for every Russian text on the board: atlas, events, glossary, opinions, sections, reading
//     paths, digests, and every library card (stored as `u` inside the card).
//   * Russian cards for library pages that have none yet, translated from the English title and description
//     (stored with `m: 1`, so a hand-written card from library-notes.mjs replaces it).
// Engine: GitHub Models through the workflow's own GITHUB_TOKEN (permission `models: read`), free tier, no secret
// and no paid account. Models are tried in order; one that hits its daily limit is skipped for the rest of the run.
// Every answer passes checks (right script, every number kept, every Latin name kept, sane length, no hype) or it
// is thrown away; what is not translated today shows the Russian text and is tried again on the next run.
// A text is re-translated only when we made it and its Russian source changed since; a hand-written `uz` is never touched.
//   node scripts/translate.mjs [--budget=140] [--dry] [--sample=N] [--only=core|library]
// State (source and output hashes) lives in pipeline/translate/state.json. Without a token it reports what is missing.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, parseArgs, readJsonOr, isMain, sha, tashkentDate } from "./lib.mjs";

// ------------------------------------------------------------------ pure checks (tested in test.mjs)
const CYR = /[Ѐ-ӿ]/g;
const LAT = /[A-Za-z]/g;
const count = (s, re) => (String(s).match(re) || []).length;

/** Uzbek Latin apostrophes: o‘ g‘ with U+2018, the tutuq belgisi as U+02BC; straight quotes become «». */
export function normUz(s) {
  return String(s)
    .replace(/([OoGg])['`ʻ’‘ʼ](?=[a-zA-Z])/g, "$1‘")
    .replace(/([a-zA-Z])['`’ʻ](?=[a-zA-Z])/g, "$1ʼ")
    .replace(/"([^"]+)"/g, "«$1»")
    .replace(/\s+/g, " ").trim();
}
/** Russian clean-up in the house style: no long dashes, «» quotes, single spaces. */
export function normRu(s) {
  return String(s).replace(/\s*[—–]\s+/g, ", ").replace(/"([^"]+)"/g, "«$1»").replace(/\s+/g, " ").trim();
}
/** Every number in a text, separators removed: "1,100 и $1.4T" -> ["1100", "14"]. */
export const numbers = s => (String(s).match(/\d[\d\s.,]*\d|\d/g) || []).map(n => n.replace(/\D/g, "")).filter(Boolean).sort();
/** Latin names inside a Russian text (Claude, Opus 4.5, MCP): they must survive translation unchanged. */
export const names = s => [...new Set(String(s).match(/[A-Za-z][A-Za-z0-9+#.\-]*[A-Za-z0-9+#]|[A-Za-z]/g) || [])].filter(w => /[A-Z0-9]/.test(w));
const BRANDS = ["Anthropic", "Claude", "Opus", "Sonnet", "Haiku", "MCP", "API", "SDK"];

/** Why a translation must be rejected, or null when it is fine. `src` and `out` are single strings. */
export function reject(src, out, to, max = 600) {
  const o = String(out || "").trim(), s = String(src || "").trim();
  if (!o) return "empty";
  if (o.length > max) return `longer than ${max}`;
  if (o === s && s.length > 12) return "not translated";
  const letters = count(o, CYR) + count(o, LAT);
  if (to === "uz" && count(o, CYR) > 0) return "Cyrillic in Uzbek";
  if (to === "ru" && letters > 8 && count(o, CYR) / letters < 0.3) return "not Russian";
  const ns = numbers(s), no = numbers(o).join(" ") + " ";
  for (const n of ns) if (!(" " + no).includes(" " + n + " ") && !no.includes(n)) return `number ${n} lost`;
  const keep = to === "uz" ? names(s) : names(s).filter(w => BRANDS.includes(w));
  for (const w of keep) if (!o.includes(w) && !(w.length <= 3 && o.toLowerCase().includes(w.toLowerCase()))) return `name ${w} lost`;
  if (/!/.test(o) && !/!/.test(s)) return "exclamation";
  const r = o.length / Math.max(s.length, 1);
  if (s.length > 25 && (r < 0.45 || r > 2.4)) return `length ratio ${r.toFixed(2)}`;
  if (/\b(translate|translation|перевод:|tarjima:)/i.test(o) && !/translat|перевод|tarjima/i.test(s)) return "talks about translating";
  return null;
}

// ------------------------------------------------------------------ jobs
const CORE = ["data/atlas.json", "data/events.json", "data/glossary.json", "data/opinions.json", "data/modules.json", "data/library-notes.json#paths", "data/digests/index.json"];
const MAX_UZ = { t: 140, s: 320, d: 140 };

/** Walks a JSON value and yields every {ru, en?, uz?} object with a stable path (array items keyed by id). */
export function* i18nNodes(v, path = "") {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) yield* i18nNodes(v[i], `${path}/${v[i]?.id ?? v[i]?.date ?? i}`); return; }
  if (!v || typeof v !== "object") return;
  if (typeof v.ru === "string" && v.ru.trim()) { yield { node: v, path }; if (!Array.isArray(v.items)) return; }
  for (const [k, x] of Object.entries(v)) if (!["sources", "links", "ru", "en", "uz", "items"].includes(k) || (k === "items" && typeof v.ru !== "string")) yield* i18nNodes(x, `${path}/${k}`);
}

/** Decides whether a target text must be (re)made: missing, or ours and its source changed. Hand-written text is kept. */
export function needs(state, key, src, cur) {
  if (!cur) return true;
  const st = state[key];
  return !!st && st[1] === sha(cur) && st[0] !== sha(src);
}

export function buildJobs({ files, lib, notes, state }) {
  const jobs = [];
  for (const [rel, doc] of files) for (const { node, path } of i18nNodes(doc)) {
    const key = `${rel}${path}`;
    if (!needs(state, key, node.ru, node.uz)) continue;
    jobs.push({ key, to: "uz", fields: { x: node.ru }, hint: node.en, max: { x: 600 }, apply: o => { node.uz = o.x; } });
  }
  // reading paths: a short Russian reason per item
  for (const p of notes.paths || []) for (const it of p.items || []) {
    const key = `paths/${p.id}/${it.id}`;
    if (!it.why || !needs(state, key, it.why, it.uz)) continue;
    jobs.push({ key, to: "uz", fields: { x: it.why }, max: { x: 160 }, apply: o => { it.uz = o.x; } });
  }
  const live = lib.items.filter(i => !i.gone);
  // Russian cards for pages without one (from English), then Uzbek for every card (from Russian, English as a hint)
  for (const i of live) {
    if (notes.notes[i.id]) continue;
    const f = { t: i.title }; if (i.desc && i.desc.trim() && i.desc.trim() !== i.title.trim()) f.s = i.desc;
    jobs.push({ key: `lib/${i.id}/ru`, to: "ru", fields: f, max: { t: 140, s: 320 }, lib: i.id, apply: o => { if (!notes.notes[i.id] && o.t) notes.notes[i.id] = { t: o.t, ...(o.s ? { s: o.s } : {}), m: 1 }; } });
  }
  for (const i of live) {
    const c = notes.notes[i.id]; if (!c) continue;
    const src = [c.t, c.s, c.d].filter(Boolean).join("\n"), cur = c.u ? [c.u.t, c.u.s, c.u.d].filter(Boolean).join("\n") : "";
    if (!needs(state, `lib/${i.id}/uz`, src, cur)) continue;
    const f = { t: c.t }; if (c.s) f.s = c.s; if (c.d) f.d = c.d;
    jobs.push({ key: `lib/${i.id}/uz`, to: "uz", fields: f, hint: i.title, max: MAX_UZ, lib: i.id, apply: o => { const n = notes.notes[i.id]; if (n && o.t) n.u = { t: o.t, ...(o.s ? { s: o.s } : {}), ...(o.d ? { d: o.d } : {}) }; } });
  }
  return jobs;
}

// ------------------------------------------------------------------ engine: GitHub Models (free with GITHUB_TOKEN)
const ENDPOINT = process.env.TRANSLATE_ENDPOINT || "https://models.github.ai/inference/chat/completions";
const MODELS = (process.env.TRANSLATE_MODELS || "openai/gpt-4.1,openai/gpt-4.1-mini,openai/gpt-4o-mini").split(",").map(s => s.trim()).filter(Boolean);
const SYS = {
  uz: `You translate short texts for Anthropic Atlas, a public news board about the AI company Anthropic, from Russian into Uzbek.
Write modern literary Uzbek in the Latin script, in the neutral register of a serious Uzbek news site. Rules:
- Translate the meaning faithfully. Do not add, drop, explain or soften facts. Keep the length close to the source.
- Keep every number, percentage, amount, currency sign and date exactly (e.g. "$1.4T" stays "$1.4T", "18 ноября 2026" becomes "2026-yil 18-noyabr").
- Keep product, model, company, programme and code names exactly as written in Latin in the source (Claude, Claude Code, Opus 4.5, MCP, API, Long-Term Benefit Trust). Never transliterate them.
- People's names: use their original Latin spelling (Дарио Амодеи -> Dario Amodei). The English hint, when given, shows the original.
- Use established Uzbek terms: sun’iy intellekt, model, dasturchi, hujjatlar, aksiya, birja, IPO, baholash, trast, direktorlar kengashi, xavfsizlik, tadqiqot.
- Write o‘ and g‘ with the ‘ sign. No exclamation marks, no emojis, no quotes around the whole text. Short labels stay short labels.`,
  ru: `You translate titles and descriptions of public Anthropic web pages from English into Russian for Anthropic Atlas, a Russian-language board about the AI company Anthropic.
Rules:
- Natural, plain Russian as written by a careful Russian tech editor; not a word-for-word calque. Keep it about as long as the source.
- Keep product, model, company and code names in Latin exactly as in the source (Claude, Claude Code, MCP, Agent SDK, Opus 4.5, API, file names, commands).
- Common developer terms may stay in Latin or use the usual Russian form (промпт, токен, агент, инструмент).
- Keep every number, amount and date. Use «» quotes. No exclamation marks, no long dashes, no emojis.`
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ask(model, to, items, token) {
  const user = `Translate the "fields" of every item. Answer with JSON only: {"items":[{"id":"<same id>","fields":{<same keys>: "<translation>"}}]}.\n` +
    JSON.stringify({ items: items.map(j => ({ id: j.id, ...(j.hint ? { hint_english: j.hint } : {}), fields: j.fields })) });
  const r = await fetch(ENDPOINT, {
    method: "POST", signal: AbortSignal.timeout(180000),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ model, temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: SYS[to] }, { role: "user", content: user }] })
  });
  if (r.status === 429) { const e = new Error("rate limited"); e.rate = +(r.headers.get("retry-after") || 0); throw e; }
  if (!r.ok) { const e = new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  return new Map((parsed.items || []).map(x => [String(x.id), x.fields || {}]));
}

/** Checks one item's answer field by field; returns cleaned fields or a reason. */
export function accept(job, fields) {
  const out = {};
  for (const [k, src] of Object.entries(job.fields)) {
    let v = fields?.[k]; if (typeof v !== "string") return { why: `field ${k} missing` };
    v = job.to === "uz" ? normUz(v) : normRu(v);
    const why = reject(src, v, job.to, job.max?.[k] ?? 600);
    if (why) return { why: `${k}: ${why}` };
    out[k] = v;
  }
  return { out };
}

function batches(jobs, maxItems = 12, maxChars = 3200) {
  const out = []; let cur = [], size = 0;
  for (const j of jobs) {
    const n = Object.values(j.fields).join("").length + (j.hint || "").length;
    if (cur.length && (cur.length >= maxItems || size + n > maxChars || cur[0].to !== j.to)) { out.push(cur); cur = []; size = 0; }
    cur.push(j); size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

// ------------------------------------------------------------------ main
async function main() {
  const ROOT = repoRoot(true);
  const args = parseArgs(process.argv.slice(2));
  const P = rel => join(ROOT, rel);
  const statePath = P("pipeline/translate/state.json");
  const state = readJsonOr(statePath, {});
  const docs = new Map(), raws = new Map(); // rel -> parsed json (whole file), and its text as read
  const load = rel => { if (!docs.has(rel)) { const raw = readFileSync(P(rel), "utf8"); raws.set(rel, raw); docs.set(rel, JSON.parse(raw)); } return docs.get(rel); };
  const lib = load("data/library.json"), notes = load("data/library-notes.json");
  notes.notes ||= {}; notes.paths ||= [];
  // digests of the last 14 days carry a headline and a summary
  const dg = existsSync(P("data/digests")) ? readdirSync(P("data/digests")).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(-14).map(f => `data/digests/${f}`) : [];
  const files = [];
  if (args.only !== "library") for (const spec of [...CORE, ...dg]) {
    const [rel, part] = spec.split("#");
    if (!existsSync(P(rel))) continue;
    const doc = load(rel);
    files.push([spec, part ? { [part]: doc[part] } : doc]);
  }
  let jobs = buildJobs({ files, lib: args.only === "core" ? { items: [] } : lib, notes, state });
  jobs.forEach((j, n) => { j.id = String(n); });
  const report = { date: tashkentDate(), pending: jobs.length, done: 0, rejected: 0, requests: 0, models: {}, samples: [] };
  console.log(`translate: ${jobs.length} text(s) to make (${jobs.filter(j => j.to === "ru").length} Russian library cards, ${jobs.filter(j => j.to === "uz").length} Uzbek)`);
  if (args.sample) jobs = [...jobs.filter(j => !j.lib).slice(0, +args.sample), ...jobs.filter(j => j.to === "ru").slice(0, +args.sample), ...jobs.filter(j => j.lib && j.to === "uz").slice(0, +args.sample)];

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) { console.log("no GITHUB_TOKEN: nothing translated (the site shows the Russian text meanwhile)"); return; }
  const budget = +(args.budget || 140);
  const dead = new Set();
  // core texts first (most visible), then Russian cards (the Uzbek card needs them), then Uzbek cards
  const order = j => (j.lib ? (j.to === "ru" ? 1 : 2) : 0);
  const queue = batches([...jobs].sort((a, b) => order(a) - order(b)));
  const retry = [];
  let pause = 0, fails = 0; // three network failures in a row end the run (the service is down, try tomorrow)
  const run = async batch => {
    for (const model of MODELS) {
      if (dead.has(model)) continue;
      if (report.requests >= budget) return false;
      await sleep(pause); pause = 4500; // free tier: about 15 requests a minute
      report.requests++;
      try {
        const ans = await ask(model, batch[0].to, batch, token);
        for (const j of batch) {
          const { out, why } = accept(j, ans.get(j.id));
          if (why) { report.rejected++; if (!j.retried) { j.retried = true; retry.push(j); } else console.log(`  rejected ${j.key}: ${why}`); continue; }
          j.apply(out); j.ok = true; report.done++; report.models[model] = (report.models[model] || 0) + 1;
          const src = Object.values(j.fields).join("\n"), res = Object.values(out).join("\n");
          state[j.key] = [sha(src), sha(j.key.startsWith("lib/") && j.to === "uz" ? res : out.x ?? res)];
          if (report.samples.length < 12 && (args.dry || args.sample)) report.samples.push({ key: j.key, src, out: res });
        }
        fails = 0;
        return true;
      } catch (e) {
        if (!e.status && e.rate === undefined && ++fails >= 3) { MODELS.forEach(m => dead.add(m)); console.log(`  ${e.message}: the service is unreachable, stopping`); return false; }
        if (e.rate && e.rate > 0 && e.rate <= 90) { console.log(`  ${model}: per-minute limit, waiting ${e.rate}s`); await sleep(e.rate * 1000); report.requests--; return run(batch); }
        console.log(`  ${model}: ${e.message}${e.rate !== undefined || e.status === 403 || e.status === 401 || e.status === 404 ? " (skipped for this run)" : ""}`);
        if (e.rate !== undefined || [401, 403, 404, 413].includes(e.status)) dead.add(model);
      }
    }
    return false;
  };
  for (const b of queue) { if (dead.size === MODELS.length || report.requests >= budget) break; await run(b); }
  for (const b of batches(retry, 6)) { if (dead.size === MODELS.length || report.requests >= budget) break; await run(b); }
  report.pending = jobs.length - report.done;

  if (args.dry || args.sample) { for (const s of report.samples) console.log(`\n[${s.key}]\n  ${s.src.replace(/\n/g, "\n  ")}\n→ ${s.out.replace(/\n/g, "\n  ")}`); }
  else if (report.done) {
    for (const [rel, doc] of docs) {
      if (rel === "data/library.json") continue; // read only: the catalog belongs to library.mjs
      const text = rel.endsWith("library-notes.json") ? JSON.stringify(doc) + "\n" : JSON.stringify(doc, null, 2) + "\n";
      if (text === raws.get(rel)) continue;
      writeFileSync(P(rel) + ".tmp", text); renameSync(P(rel) + ".tmp", P(rel));
    }
    mkdirSync(P("pipeline/translate"), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state) + "\n");
  }
  mkdirSync(P("pipeline/translate"), { recursive: true });
  writeFileSync(P("pipeline/translate/last-run.json"), JSON.stringify({ ...report, samples: undefined }, null, 2) + "\n");
  console.log(`\ntranslate: ${report.done} made, ${report.rejected} rejected by checks, ${report.pending} still pending, ${report.requests} request(s) ${JSON.stringify(report.models)}`);
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });

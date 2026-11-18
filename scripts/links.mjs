#!/usr/bin/env node
// Source link health: opens every source cited by people, products, facts, events, terms and opinions and reports
// the ones that are gone (404, 410, no such host). Sites that refuse robots (401, 403, 429) or are briefly down
// (5xx, timeouts) are listed as "unsure", never as dead, so the report does not cry wolf.
// Runs weekly in .github/workflows/qa.yml (free, no model); a dead link opens one issue for the owner.
// Usage: node scripts/links.mjs [--out=pipeline/run/links.md] [--limit=N]
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { repoRoot, parseArgs, readJson, readJsonOr, isMain } from "./lib.mjs";

/** Every cited url with where it is cited. */
export function collectSources(files) {
  const map = new Map();
  const add = (url, where) => { if (typeof url !== "string" || !/^https?:\/\//.test(url)) return; if (!map.has(url)) map.set(url, []); map.get(url).push(where); };
  const each = (list, kind, idOf = x => x.id) => (list || []).forEach(x => (x.sources || []).forEach(s => add(s.url, `${kind}/${idOf(x)}`)));
  const a = files.atlas || {};
  each(a.people, "person"); each(a.products, "product"); each(a.facts, "fact");
  each(files.events?.events, "event"); each(files.glossary?.terms, "term"); each(files.opinions?.opinions, "opinion");
  return map;
}

/** dead | ok | unsure, from an HTTP status or a network error code. */
export function verdict(status, code) {
  if (code === "ENOTFOUND" || code === "EAI_AGAIN_PERMANENT") return "dead";
  if (status === 404 || status === 410) return "dead";
  if (status >= 200 && status < 400) return "ok";
  return "unsure";
}

async function probe(url, ua) {
  const go = method => fetch(url, { method, redirect: "follow", headers: { "user-agent": ua, accept: "text/html,*/*" }, signal: AbortSignal.timeout(20000) });
  try {
    let r = await go("HEAD");
    if (r.status === 405 || r.status === 403 || r.status === 404) r = await go("GET"); // many sites answer HEAD badly
    return { status: r.status, v: verdict(r.status) };
  } catch (e) {
    const code = e.cause?.code || e.code || e.name;
    return { status: 0, code, v: verdict(0, code) };
  }
}

async function main() {
  const ROOT = repoRoot(true);
  const args = parseArgs(process.argv.slice(2));
  const files = { atlas: readJson(join(ROOT, "data/atlas.json")), events: readJson(join(ROOT, "data/events.json")), glossary: readJsonOr(join(ROOT, "data/glossary.json"), {}), opinions: readJsonOr(join(ROOT, "data/opinions.json"), {}) };
  const ua = readJsonOr(join(ROOT, "sources/sources.json"), {}).userAgent || "AnthropicAtlas-linkcheck";
  let urls = [...collectSources(files).entries()];
  if (args.limit) urls = urls.slice(0, +args.limit);
  const res = [];
  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (i < urls.length) { const [u, where] = urls[i++]; res.push({ u, where, ...(await probe(u, ua)) }); } }));
  // if a large share "dies" at once, the runner's network is broken, not the web: report nothing as dead
  if (res.filter(r => r.v === "dead").length > Math.max(5, res.length * .3)) { console.log(`::warning::${res.filter(r => r.v === "dead").length} of ${res.length} links failed at once; treating it as a network problem`); res.forEach(r => { if (r.v === "dead") r.v = "unsure"; }); }
  const dead = res.filter(r => r.v === "dead"), unsure = res.filter(r => r.v === "unsure");
  const md = [`# Ссылки на источники: ${res.length} проверено`, "", `Не открываются (404, 410 или нет такого сайта): ${dead.length}. Сомнительные (сайт не пускает роботов или временно недоступен): ${unsure.length}.`, ""];
  if (dead.length) md.push("## Не открываются", "", ...dead.map(r => `- ${r.u} (${r.status || r.code}), где: ${r.where.slice(0, 4).join(", ")}`), "");
  if (unsure.length) md.push("## Сомнительные", "", ...unsure.map(r => `- ${r.u} (${r.status || r.code})`), "");
  const out = resolve(ROOT, args.out || "pipeline/run/links.md");
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, md.join("\n") + "\n");
  console.log(md.join("\n"));
  process.exit(dead.length ? 1 : 0);
}
if (isMain(import.meta.url)) main();

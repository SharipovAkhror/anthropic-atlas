#!/usr/bin/env node
// Enrichment: reference links + portraits for people. Runs in GitHub Actions (needs open internet).
// For each person (kind "person"):
//   1. Finds the English Wikipedia article. A candidate is accepted ONLY if its intro mentions "Anthropic"
//      (prevents namesakes such as another "Paul Smith"). Existing links are never overwritten.
//   2. Stores links.wikipedia and links.wikidata.
//   3. Saves a portrait to assets/people/<id>.jpg (Wikipedia lead image first, else the existing avatar URL),
//      then points avatar at the local file so the site never depends on hot-linked images.
// People without any photo get a monogram icon in the UI; that is expected, not an error.
// Usage: node scripts/enrich.mjs [--dry] [--force-images]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const UA = JSON.parse(readFileSync(join(ROOT, "sources/sources.json"), "utf8")).userAgent;
const atlasPath = join(ROOT, "data/atlas.json");
const atlas = JSON.parse(readFileSync(atlasPath, "utf8"));
mkdirSync(join(ROOT, "assets/people"), { recursive: true });

async function json(url) {
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}
async function bytes(url) {
  const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = r.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
  return Buffer.from(await r.arrayBuffer());
}
const cleanName = n => n.replace(/^(Dr\.|Prof\.)\s*/i, "").replace(/\s*'[^']+'\s*/g, " ").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

async function findWiki(person) {
  if (person.links?.wikipedia) {
    const title = decodeURIComponent(person.links.wikipedia.split("/wiki/")[1] || "");
    return title ? json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`).catch(() => null) : null;
  }
  const q = encodeURIComponent(`"${cleanName(person.name)}" Anthropic`);
  const s = await json(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=5&format=json`);
  for (const hit of s.query?.search || []) {
    const sum = await json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`).catch(() => null);
    if (!sum || sum.type === "disambiguation") continue;
    const last = cleanName(person.name).split(" ").at(-1).toLowerCase();
    if (/anthropic/i.test(sum.extract || "") && sum.title.toLowerCase().includes(last)) return sum;
  }
  return null;
}

let changed = 0;
const log = [];
for (const p of atlas.people) {
  if (p.kind !== "person") continue;
  try {
    const wiki = await findWiki(p);
    if (wiki) {
      p.links ||= {};
      if (!p.links.wikipedia && wiki.content_urls?.desktop?.page) { p.links.wikipedia = wiki.content_urls.desktop.page; changed++; log.push(`${p.id}: wikipedia ${p.links.wikipedia}`); }
      if (!p.links.wikidata && wiki.wikibase_item) { p.links.wikidata = `https://www.wikidata.org/wiki/${wiki.wikibase_item}`; changed++; }
    }
    const local = `assets/people/${p.id}.jpg`;
    if (!existsSync(join(ROOT, local)) || args.has("--force-images")) {
      const candidates = [];
      if (wiki?.thumbnail?.source) candidates.push([wiki.thumbnail.source.replace(/\/\d+px-/, "/320px-"), "Wikimedia Commons"]);
      if (p.avatar?.startsWith("https://")) candidates.push([`https://images.weserv.nl/?url=${encodeURIComponent(p.avatar)}&w=320&h=320&fit=cover&output=jpg`, new URL(p.avatar).hostname]);
      for (const [url, credit] of candidates) {
        try {
          const buf = await bytes(url);
          if (buf.length < 2000 || buf.length > 600000) throw new Error(`size ${buf.length}`);
          if (!args.has("--dry")) writeFileSync(join(ROOT, local), buf);
          p.avatar = `/${local}`; p.avatarCredit = credit; changed++;
          log.push(`${p.id}: photo from ${credit}`);
          break;
        } catch (e) { log.push(`${p.id}: photo failed (${credit}: ${e.message})`); }
      }
    } else if (p.avatar !== `/${local}`) { p.avatar = `/${local}`; changed++; }
  } catch (e) { log.push(`${p.id}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 150));
}
console.log(log.join("\n"));
const withPhoto = atlas.people.filter(p => p.avatar?.startsWith("/assets/")).length;
const withWiki = atlas.people.filter(p => p.links?.wikipedia).length;
console.log(`\n${changed} change(s). Photos: ${withPhoto}/${atlas.people.length}. Wikipedia: ${withWiki}/${atlas.people.length}.`);
if (!args.has("--dry") && changed) writeFileSync(atlasPath, JSON.stringify(atlas, null, 2) + "\n");

#!/usr/bin/env node
// Browser smoke test: opens the real site in headless Chromium on a laptop and on a phone and fails on
// any page error or missing core element. Runs in CI before data is published and hourly against production.
// Usage: node scripts/smoke.mjs                 (serves this checkout on a free port)
//        node scripts/smoke.mjs --url=https://anthropic-atlas.vercel.app
//        node scripts/smoke.mjs --shots=/tmp/dir (also saves screenshots)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { join, extname, normalize } from "node:path";
import { repoRoot, parseArgs } from "./lib.mjs";

const ROOT = repoRoot(true);
const args = parseArgs(process.argv.slice(2));
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(join(execSync("npm root -g").toString().trim(), "playwright")); }

// the local server sends the production Content-Security-Policy, so a page the CSP would break fails here first
let CSP = "";
try { CSP = JSON.parse(await readFile(join(ROOT, "vercel.json"), "utf8")).headers.flatMap(h => h.headers).find(h => h.key === "Content-Security-Policy")?.value || ""; } catch {}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
async function serve() {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try { const b = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", ...(CSP ? { "content-security-policy": CSP } : {}) }).end(b); }
    catch { res.writeHead(404).end("not found"); }
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  return { srv, url: `http://127.0.0.1:${srv.address().port}` };
}

let failed = 0;
const ok = (cond, name) => { console.log(`${cond ? "pass" : "FAIL"}  ${name}`); if (!cond) failed++; };

setTimeout(() => { console.log("FAIL  smoke run took longer than 3 minutes"); process.exit(2); }, 180000).unref();
const local = !args.url && (await serve());
const BASE = args.url || local.url;
const browser = await pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const prep = async page => {
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|favicon|ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(() => { try { sessionStorage.setItem("atlas.intro", "1"); localStorage.setItem("atlas.hint", "1"); } catch {} });
  return errs;
};
const shot = async (page, name) => args.shots && page.screenshot({ path: join(args.shots, `${name}.png`) });

try {
  // laptop
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = await prep(page);
  const resp = await page.goto(BASE + "/", { waitUntil: "load" });
  ok(resp && resp.status() === 200, `laptop: page answers 200 (${resp?.status()})`);
  const libN = await page.evaluate(() => fetch("/data/library.json").then(r => r.json()).then(j => j.items.filter(i => !i.gone).length).catch(() => 0));
  ok(libN > 500, `laptop: library data loads (${libN} live items)`);
  await page.waitForSelector(".slot", { timeout: 15000 });
  await page.waitForSelector('[data-island="lib-shelves"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  const islands = await page.$$eval(".slot", s => s.map(x => x.dataset.island));
  ok(islands.length >= 10, `laptop: ${islands.length} islands on the board`);
  ok(islands.includes("today") || await page.$(".hero .quiet") !== null, "laptop: today is on the page (digest card, or the quiet-day note)");
  ok(islands.includes("lib-shelves") && islands.includes("lib-start"), "laptop: library islands are on the board");
  ok(await page.$(".hero h1") !== null, "laptop: hero headline rendered");
  const clipped = await page.evaluate(() => [...document.querySelectorAll(".slot")].filter(s => { const r = s.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(s => s.dataset.island));
  ok(!clipped.length, `laptop: no card is cut by the window edge${clipped.length ? " (" + clipped.join(", ") + ")" : ""}`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "laptop: no horizontal overflow");
  await shot(page, "laptop-home");
  await page.click('[data-open="shelf:engineering"]');
  await page.waitForSelector("#sheet.on .shelf-list .row", { timeout: 5000 }).catch(() => {});
  const shelfRows = await page.$$eval("#sheet .shelf-list .row", r => r.length);
  ok(shelfRows > 5, `laptop: a library shelf opens with ${shelfRows} items`);
  await page.fill("#sheet .sf", "agent");
  await page.waitForTimeout(150);
  ok(await page.$$eval("#sheet .shelf-list .row", r => r.length) > 0, "laptop: searching inside a shelf finds items");
  await page.click("#sheet .shelf-list .row");
  await page.waitForTimeout(250);
  ok(await page.$("#sheet .go[href^='https://']") !== null, "laptop: a library card links to the original");
  await shot(page, "laptop-card");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("constitution");
  await page.waitForTimeout(200);
  ok(await page.$$eval("#palette li", l => l.length) > 0, "laptop: search finds library materials");
  await page.keyboard.press("Escape");
  await page.click('[data-open^="person:"]');
  await page.waitForTimeout(250);
  ok(await page.$("#sheet.on h3") !== null, "laptop: a person opens in the sheet");
  ok(errs.length === 0, `laptop: no page errors${errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""}`);
  await page.close();

  // phone
  const ctx = await browser.newContext({ ...pw.devices["iPhone 13"] });
  const ph = await ctx.newPage();
  const perrs = await prep(ph);
  await ph.goto(BASE + "/", { waitUntil: "load" });
  await ph.waitForSelector(".slot", { timeout: 15000 });
  await ph.waitForSelector('[data-island="lib-shelves"]', { timeout: 15000 }).catch(() => {});
  await ph.waitForTimeout(600);
  ok(await ph.$$eval("#tabs button", b => b.length) >= 8, "phone: section tabs rendered");
  const overflow = await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(!overflow, "phone: no horizontal page overflow");
  const wide = await ph.evaluate(() => [...document.querySelectorAll(".slot")].filter(s => s.getBoundingClientRect().width > innerWidth).map(s => s.dataset.island));
  ok(!wide.length, `phone: every card fits the screen${wide.length ? " (too wide: " + wide.join(", ") + ")" : ""}`);
  await shot(ph, "phone-home");
  ok(perrs.length === 0, `phone: no page errors${perrs.length ? ": " + perrs.slice(0, 3).join(" | ") : ""}`);
} catch (e) { ok(false, `smoke run crashed: ${e.message}`); }
finally { await browser.close(); if (local) local.srv.close(); }

console.log(failed ? `\n${failed} smoke check(s) FAILED on ${BASE}` : `\nall smoke checks passed on ${BASE}`);
process.exit(failed ? 1 : 0);

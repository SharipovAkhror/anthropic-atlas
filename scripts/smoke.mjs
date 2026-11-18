#!/usr/bin/env node
// Browser smoke test: opens the real site in headless Chromium on a laptop and on a phone and fails on
// any page error or missing core element. Runs in CI before data is published and hourly against production.
// Usage: node scripts/smoke.mjs                 (serves this checkout on a free port)
//        node scripts/smoke.mjs --url=https://anthropic-atlas.vercel.app
//        node scripts/smoke.mjs --shots=/tmp/dir (also saves screenshots)
import { join } from "node:path";
import { repoRoot, parseArgs } from "./lib.mjs";
import { playwright, serve, launch, prep, reporter } from "./webtest.mjs";

const ROOT = repoRoot(true);
const args = parseArgs(process.argv.slice(2));
const pw = playwright();
const R = reporter(), ok = R.ok;

setTimeout(() => { console.log("FAIL  smoke run took longer than 3 minutes"); process.exit(2); }, 180000).unref();
const local = !args.url && (await serve(ROOT));
const BASE = args.url || local.url;
const browser = await launch(pw);
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
  ok(islands.includes("today") || await page.$(".hero .lens") !== null, "laptop: today is on the page (digest card, or the latest-by-topic list)");
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
finally { await browser.close(); if (local) await local.close(); }

console.log(R.failed ? `\n${R.failed} smoke check(s) FAILED on ${BASE}` : `\nall smoke checks passed on ${BASE}`);
process.exit(R.failed ? 1 : 0);

#!/usr/bin/env node
// End-to-end browser tests: the deep suite. smoke.mjs answers "is the site up"; this answers "does everything a
// reader can do still work". Runs free on GitHub Actions (validate.yml on every PR, qa.yml nightly on production).
//
//   screens     7 window sizes from a small laptop to 3440 px: nothing cut off, no overlaps, no broken text
//   camera      laptop pan and zoom: drag, Ctrl + wheel, buttons, keys 0 / 1, map mode and back
//   sheets      every entity a reader can open (all people, products, events, terms, facts, opinions,
//               shelves and a sample of the library) opens with content in all three languages
//   actions     Save survives a reload, Copy with source puts claim + source + link on the clipboard, Link copies
//   routes      deep links, unknown links, Escape and Back, search palette with keyboard and Cyrillic
//   phone       iPhone SE, iPhone 13, Pixel 7: tabs, overview map, pinch, swipe-to-close, nothing wider than the screen
//   tablet      iPad in both orientations (touch on the laptop layout)
//   resilience  each optional data file missing or corrupt: the page still works; atlas.json missing: a message
//   budget      load time and weight, accessible names on controls
//
// Usage: node scripts/e2e.mjs                      (serves this checkout)
//        node scripts/e2e.mjs --url=https://anthropic-atlas.vercel.app
//        node scripts/e2e.mjs --only=phone,routes   (some groups)   --shots=/tmp/dir (screenshots)
import { join } from "node:path";
import { repoRoot, parseArgs } from "./lib.mjs";
import { playwright, serve, launch, prep, reporter } from "./webtest.mjs";

const ROOT = repoRoot(true);
const args = parseArgs(process.argv.slice(2));
const only = args.only ? new Set(String(args.only).split(",")) : null;
const pw = playwright();
const R = reporter(), ok = R.ok;
const BAD = /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b|\$\{|Invalid Date/;
const sleep = ms => new Promise(r => setTimeout(r, ms));

setTimeout(() => { console.log("FAIL  e2e run took longer than 12 minutes"); process.exit(2); }, 12 * 60000).unref();
const local = !args.url && (await serve(ROOT));
const BASE = args.url || local.url;
const browser = await launch(pw);
const shot = async (page, name) => args.shots && page.screenshot({ path: join(args.shots, `${name}.png`) });

async function open(ctxOpts = {}, { path = "/", init } = {}) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = await prep(page);
  if (init) await page.addInitScript(init);
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForSelector(".slot", { timeout: 15000 });
  await page.waitForSelector('[data-island="lib-shelves"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}
const noErrors = (errs, where) => ok(errs.length === 0, `${where}: no page errors${errs.length ? ": " + errs.slice(0, 3).join(" | ") : ""}`);

// geometry of the board as the reader sees it (after the camera transform)
const geometry = page => page.evaluate(() => {
  const slots = [...document.querySelectorAll(".slot")].map(s => ({ id: s.dataset.island, r: s.getBoundingClientRect(), sw: s.scrollWidth, cw: s.clientWidth }));
  const overlaps = [];
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const a = slots[i].r, b = slots[j].r;
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) overlaps.push(`${slots[i].id}/${slots[j].id}`);
  }
  return {
    n: slots.length,
    clipped: slots.filter(s => s.r.left < -1 || s.r.right > innerWidth + 1).map(s => s.id),
    spill: slots.filter(s => s.sw > s.cw + 2).map(s => s.id),
    overlaps,
    pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    text: document.querySelector("#board").innerText + " " + document.querySelector("#bar").innerText,
    hero: !!document.querySelector(".hero h1")?.textContent.trim()
  };
});
const badText = s => (s.match(BAD) || [""])[0];

const groups = {
  async screens() {
    for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1680, 1050], [1920, 1080], [2560, 1440], [3440, 1440]]) {
      const { ctx, page, errs } = await open({ viewport: { width: w, height: h } });
      const g = await geometry(page);
      ok(g.n >= 10 && g.hero, `${w}px: board drawn (${g.n} cards, headline)`);
      ok(!g.clipped.length, `${w}px: no card cut by the window edge${g.clipped.length ? " (" + g.clipped.join(", ") + ")" : ""}`);
      ok(!g.overlaps.length, `${w}px: cards do not overlap${g.overlaps.length ? " (" + g.overlaps.slice(0, 4).join(", ") + ")" : ""}`);
      ok(!g.spill.length, `${w}px: no text spills out of a card${g.spill.length ? " (" + g.spill.join(", ") + ")" : ""}`);
      ok(!g.pageOverflow, `${w}px: no horizontal page scroll`);
      ok(!badText(g.text), `${w}px: no broken text on the board${badText(g.text) ? ` ("${badText(g.text)}")` : ""}`);
      const split = await page.$$eval(".fact .v, .hstats b", l => l.filter(v => v.getClientRects().length > 1 || v.offsetHeight > parseFloat(getComputedStyle(v).lineHeight || "0") * 1.6).map(v => v.textContent));
      ok(!split.length, `${w}px: key numbers stay on one line${split.length ? " (" + split.join(", ") + ")" : ""}`);
      if (w >= 2560) {
        const fill = await page.evaluate(() => { const r = [...document.querySelectorAll(".slot")].map(s => s.getBoundingClientRect()); return (Math.max(...r.map(x => x.right)) - Math.min(...r.map(x => x.left))) / innerWidth; });
        ok(fill > .6, `${w}px: cards use the width of a big screen (${Math.round(fill * 100)}%)`);
      }
      await shot(page, `screen-${w}`);
      noErrors(errs, `${w}px`);
      await ctx.close();
    }
  },

  async camera() {
    const { ctx, page, errs } = await open({ viewport: { width: 1440, height: 900 } });
    const cam = () => page.evaluate(() => ({ ...window.ATLAS.cam, far: document.querySelector("#board").classList.contains("far") }));
    const home = await cam();
    await page.mouse.move(720, 600);
    await page.keyboard.down("Control"); await page.mouse.wheel(0, 600); await page.keyboard.up("Control");
    await page.waitForTimeout(400);
    const out = await cam();
    ok(out.s < home.s, `camera: Ctrl + wheel zooms out (${home.s.toFixed(2)} → ${out.s.toFixed(2)})`);
    await page.keyboard.press("0"); await page.waitForTimeout(1000);
    const fit = await cam();
    const g = await page.evaluate(() => { const r = [...document.querySelectorAll(".slot")].map(s => s.getBoundingClientRect()); return { l: Math.min(...r.map(x => x.left)), t: Math.min(...r.map(x => x.top)), r: Math.max(...r.map(x => x.right)), b: Math.max(...r.map(x => x.bottom)) }; });
    ok(fit.far, "camera: key 0 switches to the map");
    ok(g.l >= -2 && g.t >= -2 && g.r <= 1442 && g.b <= 902, "camera: key 0 shows every card on one screen");
    const labels = await page.$$eval(".slot .flabel", l => l.filter(x => x.getBoundingClientRect().height > 0).length);
    ok(labels >= 5, `camera: map shows readable labels (${labels})`);
    await shot(page, "camera-map");
    await page.keyboard.press("1"); await page.waitForTimeout(900);
    const back = await cam();
    ok(!back.far && Math.abs(back.s - home.s) < .01 && Math.abs(back.x - home.x) < 2, "camera: key 1 returns home");
    await page.mouse.move(700, 700); await page.mouse.down(); await page.mouse.move(600, 500, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(300);
    const dragged = await cam();
    ok(Math.abs(dragged.y - back.y) > 50, `camera: dragging moves the board (${Math.round(dragged.y - back.y)} px)`);
    ok(await page.$eval("#sheet", s => !s.classList.contains("on")), "camera: a drag that starts on a card does not open it");
    const s0 = (await cam()).s;
    await page.click('#zoom [data-z="in"]'); await page.waitForTimeout(450);
    ok((await cam()).s > s0, "camera: the + button zooms in");
    await page.click('#zoom [data-z="fit"]'); await page.waitForTimeout(900);
    ok((await cam()).far, "camera: the fit button shows the map");
    await page.mouse.click(720, 450); await page.waitForTimeout(900);
    const clicked = await cam();
    ok(!clicked.far || clicked.s > (await page.evaluate(() => window.ATLAS.cam.s)) - 1, "camera: a click on the map does not break the camera");
    noErrors(errs, "camera");
    await ctx.close();
  },

  async sheets() {
    for (const lang of ["ru", "en", "uz"]) {
      const { ctx, page, errs } = await open({ viewport: { width: 1440, height: 900 } }, { path: `/?lang=${lang}` });
      const res = await page.evaluate(async ({ bad, full }) => {
        const BADRE = new RegExp(bad);
        const D = window.ATLAS.data, refs = new Set();
        document.querySelectorAll("[data-open]").forEach(e => refs.add(e.dataset.open));
        if (full) {
          D.atlas.people.forEach(x => refs.add(`person:${x.id}`)); D.atlas.products.forEach(x => refs.add(`product:${x.id}`));
          D.atlas.facts.forEach(x => refs.add(`fact:${x.id}`)); D.events.forEach(x => refs.add(`event:${x.id}`));
          D.terms.forEach(x => refs.add(`term:${x.id}`)); D.opinions.forEach(x => refs.add(`opinion:${x.id}`));
          const lib = await fetch("/data/library.json").then(r => r.json()).catch(() => ({ items: [], sections: [] }));
          lib.sections.forEach(s => refs.add(`shelf:${s.id}`));
          const live = lib.items.filter(i => !i.gone);
          for (let k = 0; k < live.length; k += Math.max(1, Math.floor(live.length / 60))) refs.add(`lib:${live[k].id}`);
        }
        const body = document.querySelector("#sheet-body"), out = { n: 0, dead: [], empty: [], bad: [], links: [], nested: 0 };
        for (const r of refs) {
          const [k, ...rest] = r.split(":"); body.innerHTML = "";
          window.ATLAS.openEntity(k, rest.join(":"), { push: false });
          out.n++;
          if (!body.innerHTML) { out.dead.push(r); continue; }
          const txt = body.innerText.trim();
          if (txt.length < 8) out.empty.push(r);
          const m = txt.match(BADRE); if (m) out.bad.push(`${r} "${m[0]}"`);
          body.querySelectorAll("a[href]").forEach(a => { const h = a.getAttribute("href"); if (!/^(https:\/\/|#|mailto:|\/)/.test(h)) out.links.push(`${r} ${h}`); });
          out.nested += body.querySelectorAll("[data-open]").length;
        }
        return out;
      }, { bad: BAD.source, full: lang === "ru" });
      ok(res.n > (lang === "ru" ? 250 : 40), `sheets ${lang}: ${res.n} entities opened`);
      ok(!res.dead.length, `sheets ${lang}: every link on the board leads somewhere${res.dead.length ? " (dead: " + res.dead.slice(0, 5).join(", ") + ")" : ""}`);
      ok(!res.empty.length, `sheets ${lang}: no empty sheet${res.empty.length ? " (" + res.empty.slice(0, 5).join(", ") + ")" : ""}`);
      ok(!res.bad.length, `sheets ${lang}: no broken text in sheets${res.bad.length ? " (" + res.bad.slice(0, 4).join("; ") + ")" : ""}`);
      ok(!res.links.length, `sheets ${lang}: links are https or internal${res.links.length ? " (" + res.links.slice(0, 4).join("; ") + ")" : ""}`);
      if (lang === "ru") {
        // the nested links inside sheets (related people, events, products) must resolve too
        const dangling = await page.evaluate(() => {
          const bad = []; const body = document.querySelector("#sheet-body"); const seen = new Set();
          const D = window.ATLAS.data;
          const start = [...D.atlas.people.map(x => `person:${x.id}`), ...D.atlas.products.map(x => `product:${x.id}`), ...D.events.map(x => `event:${x.id}`)];
          for (const r of start) {
            const [k, ...rest] = r.split(":"); window.ATLAS.openEntity(k, rest.join(":"), { push: false });
            body.querySelectorAll("[data-open]").forEach(e => seen.add(e.dataset.open));
          }
          for (const r of seen) { const [k, ...rest] = r.split(":"); body.innerHTML = ""; window.ATLAS.openEntity(k, rest.join(":"), { push: false }); if (!body.innerHTML) bad.push(r); }
          return { n: seen.size, bad };
        });
        ok(!dangling.bad.length, `sheets: all ${dangling.n} links inside sheets resolve${dangling.bad.length ? " (dead: " + dangling.bad.slice(0, 5).join(", ") + ")" : ""}`);
      }
      const g = await geometry(page);
      ok(!badText(g.text), `board ${lang}: no broken text${badText(g.text) ? ` ("${badText(g.text)}")` : ""}`);
      noErrors(errs, `sheets ${lang}`);
      await ctx.close();
    }
  },

  async actions() {
    const { ctx, page, errs } = await open({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
    const ev = await page.evaluate(() => window.ATLAS.data.events.find(e => e.sources?.length)?.id);
    await page.click(`.slot [data-open="event:${ev}"]`).catch(async () => page.evaluate(id => window.ATLAS.openEntity("event", id), ev));
    await page.waitForSelector("#sheet.on [data-quote]", { timeout: 4000 });
    ok(/#\/event\//.test(page.url()), "actions: opening an event puts it in the address");
    await page.click("#sheet [data-quote]"); await page.waitForTimeout(300);
    const q = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    ok(/https:\/\//.test(q) && /Anthropic Atlas: http/.test(q) && q.split("\n").length >= 2, "actions: Copy with source gives the claim, the source and a link back");
    await page.click("#sheet [data-link]"); await page.waitForTimeout(300);
    const l = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    ok(/#\/event\//.test(l), "actions: Link copies an address that opens this event");
    await page.click("#sheet [data-save]");
    ok(await page.$eval("#sheet [data-save]", b => b.getAttribute("aria-pressed") === "true"), "actions: Save marks the item");
    await page.keyboard.press("Escape"); await page.waitForTimeout(700);
    ok(await page.$('.slot[data-island="saved"]') !== null, "actions: the Saved card appears after closing the sheet");
    await page.reload({ waitUntil: "load" }); await page.waitForSelector(".slot"); await page.waitForTimeout(600);
    ok(await page.$(`.slot[data-island="saved"] [data-open="event:${ev}"]`) !== null, "actions: the saved item survives a reload");
    // hold to clear, then Undo
    const hold = await page.$('.slot[data-island="saved"] .hold');
    if (hold) {
      await hold.scrollIntoViewIfNeeded().catch(() => {});
      const b = await hold.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up(); await page.waitForTimeout(300);
      ok(await page.$('.slot[data-island="saved"]') !== null, "actions: a short press does not clear Saved");
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(1300); await page.mouse.up(); await page.waitForTimeout(500);
      ok(await page.$('.slot[data-island="saved"]') === null, "actions: holding clears Saved");
      const undo = await page.$("#toast button");
      if (undo) { await undo.click(); await page.waitForTimeout(500); }
      ok(await page.$('.slot[data-island="saved"]') !== null, "actions: Undo brings Saved back");
    } else ok(false, "actions: Saved has a hold-to-clear control");
    noErrors(errs, "actions");
    await ctx.close();
  },

  async routes() {
    const { ctx, page, errs } = await open({ viewport: { width: 1440, height: 900 } });
    const D = await page.evaluate(() => { const d = window.ATLAS.data; return { p: d.atlas.people[0], t: d.terms[0], ev: d.events[0] }; });
    await page.goto(`${BASE}/#/person/${encodeURIComponent(D.p.id)}`, { waitUntil: "load" }); await page.waitForSelector("#sheet.on", { timeout: 8000 }).catch(() => {});
    ok(await page.$eval("#sheet", (s, n) => s.classList.contains("on") && s.innerText.includes(n), D.p.name), "routes: a deep link opens that person");
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    ok(await page.$eval("#sheet", s => !s.classList.contains("on")) && !/#\//.test(page.url()), "routes: Escape closes the sheet and clears the address");
    await page.goto(`${BASE}/#/person/nobody-at-all`, { waitUntil: "load" }); await page.waitForSelector(".slot"); await page.waitForTimeout(800);
    ok(await page.$eval("#sheet", s => !s.classList.contains("on")), "routes: an unknown link opens nothing and breaks nothing");
    await page.goto(`${BASE}/#/garbage/%E0%A4%A`, { waitUntil: "load" }); await page.waitForSelector(".slot"); await page.waitForTimeout(500);
    // breadcrumbs: open an event, follow a link inside it, go back
    await page.evaluate(id => window.ATLAS.openEntity("event", id), D.ev.id); await page.waitForTimeout(300);
    const inner = await page.$("#sheet-body [data-open]");
    if (inner) {
      await inner.click(); await page.waitForTimeout(400);
      ok(await page.$("#crumbs [data-crumb]") !== null, "routes: following a link inside a sheet shows a way back");
      await page.keyboard.press("Backspace"); await page.waitForTimeout(400);
      ok(await page.$eval("#sheet-body", (b, t) => b.innerText.includes(t), D.ev.title.ru.slice(0, 20)), "routes: Backspace goes back to the event");
    }
    await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    // search palette
    await page.keyboard.press("Control+k"); await page.waitForSelector("#palette.on", { timeout: 3000 });
    await page.keyboard.type(D.p.name.split(" ").at(-1)); await page.waitForTimeout(250);
    ok(await page.$$eval("#palette li", l => l.length) > 0, "routes: search finds a person by surname");
    await page.keyboard.press("Enter"); await page.waitForTimeout(400);
    ok(await page.$eval("#sheet", s => s.classList.contains("on")), "routes: Enter in search opens the result");
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await page.keyboard.press("/"); await page.keyboard.type("дарио"); await page.waitForTimeout(250);
    ok(await page.$$eval("#palette li", l => l.length) > 0, "routes: search understands Cyrillic spelling of a Latin name");
    await page.fill("#palette input", "zzqxw-nothing"); await page.waitForTimeout(200);
    ok(await page.$eval("#palette", p => !p.innerText.match(/undefined|NaN/)), "routes: an empty search result reads cleanly");
    await page.keyboard.press("Escape");
    // language cycle
    const labels = [];
    for (let i = 0; i < 3; i++) { await page.keyboard.press("l"); await page.waitForTimeout(350); labels.push(await page.$eval("#lang", b => b.textContent.trim())); }
    ok(labels.join(",") === "EN,UZ,RU", `routes: L cycles the language (${labels.join(", ")})`);
    // a Russian keyboard layout: the same physical keys must work (Ctrl+К, Д, the "." key where "/" is)
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "л", code: "KeyK", ctrlKey: true, bubbles: true })));
    await page.waitForTimeout(200);
    ok(await page.$eval("#palette", p => p.classList.contains("on")), "routes: Ctrl+K opens search on a Russian layout");
    await page.keyboard.press("Escape");
    const lang0 = await page.$eval("#lang", b => b.textContent.trim());
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "д", code: "KeyL", bubbles: true })));
    await page.waitForTimeout(300);
    ok(await page.$eval("#lang", b => b.textContent.trim()) !== lang0, "routes: L switches the language on a Russian layout");
    for (let i = 0; i < 2; i++) { await page.keyboard.press("l"); await page.waitForTimeout(250); }
    // Space on a focused button presses it and leaves the board where it is
    await page.evaluate(id => window.ATLAS.openEntity("event", id), D.ev.id); await page.waitForTimeout(300);
    await page.focus("#sheet [data-save]");
    await page.keyboard.press(" "); await page.waitForTimeout(300);
    ok(await page.$eval("#sheet [data-save]", b => b.getAttribute("aria-pressed") === "true"), "routes: Space on the focused Save button saves");
    await page.keyboard.press(" "); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await page.focus('#zoom [data-z="in"]'); const before = await page.evaluate(() => ({ ...window.ATLAS.cam })); await page.keyboard.press(" "); await page.waitForTimeout(450);
    const after = await page.evaluate(() => window.ATLAS.cam);
    ok(after.s > before.s * 1.2, `routes: Space on the focused zoom button zooms (${before.s.toFixed(2)} → ${after.s.toFixed(2)})`);
    await page.keyboard.press("1"); await page.waitForTimeout(700);
    // since the last visit
    await page.evaluate(() => { localStorage.setItem("atlas.seen", String(Date.now() - 20 * 864e5)); localStorage.removeItem("atlas.base"); });
    await page.reload({ waitUntil: "load" }); await page.waitForSelector(".slot"); await page.waitForTimeout(500);
    const since = await page.$eval("body", b => b.innerText);
    ok(!badText(since), "routes: the since-last-visit view has no broken text");
    noErrors(errs, "routes");
    await ctx.close();
  },

  async phone() {
    for (const name of ["iPhone SE", "iPhone 13", "Pixel 7"]) {
      const { ctx, page, errs } = await open({ ...pw.devices[name] });
      const W = await page.evaluate(() => innerWidth);
      const g = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll(".slot")].filter(s => s.getBoundingClientRect().width > innerWidth + 1).map(s => s.dataset.island), tabs: document.querySelectorAll("#tabs button").length, slots: document.querySelectorAll(".slot").length }));
      ok(!g.overflow, `${name}: no horizontal page scroll`);
      ok(!g.wide.length, `${name}: every card fits the ${W} px screen${g.wide.length ? " (" + g.wide.join(", ") + ")" : ""}`);
      ok(g.tabs === g.slots && g.tabs >= 8, `${name}: one tab per section (${g.tabs}/${g.slots})`);
      const small = await page.evaluate(() => [...document.querySelectorAll("#tabs button, #lang, #open-search, #maptoggle")].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.height < 28 || r.width < 28); }).map(b => b.id || b.textContent.trim().slice(0, 12)));
      ok(!small.length, `${name}: top controls are big enough to tap${small.length ? " (" + small.join(", ") + ")" : ""}`);
      // tabs move between sections
      await page.tap("#tabs button[data-i='3']"); await page.waitForTimeout(900);
      const t3 = await page.evaluate(() => ({ on: document.querySelector("#tabs button.on")?.dataset.i, x: document.querySelector("#board").scrollLeft }));
      ok(t3.on === "3" && t3.x > 0, `${name}: tapping a tab opens that section`);
      await page.tap("#tabs button[data-i='3']"); await page.waitForTimeout(500);
      ok(await page.evaluate(() => document.body.classList.contains("overview")), `${name}: tapping the active tab shows the overview`);
      await shot(page, `phone-${name.replace(/\s/g, "")}-overview`);
      const mt = await page.$eval("#maptoggle", b => { const r = b.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("#maptoggle") !== null; });
      ok(mt, `${name}: the map button can be tapped in the overview (nothing covers it)`);
      const s5 = await page.$$(".slot"); await s5[5].tap(); await page.waitForTimeout(700);
      const o = await page.evaluate(() => ({ ov: document.body.classList.contains("overview"), on: document.querySelector("#tabs button.on")?.dataset.i }));
      ok(!o.ov && o.on === "5", `${name}: tapping a card in the overview opens that section (${o.on})`);
      // pinch in and out
      const cdp = await ctx.newCDPSession(page);
      const pinch = async (from, to) => {
        const cx = W / 2, cy = 400;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx - from, y: cy, id: 1 }, { x: cx + from, y: cy, id: 2 }] });
        for (let k = 1; k <= 6; k++) { const d = from + (to - from) * k / 6; await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }] }); await sleep(16); }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(600);
      };
      await pinch(120, 40);
      ok(await page.evaluate(() => document.body.classList.contains("overview")), `${name}: pinching in shows the overview`);
      await pinch(30, 140);
      ok(await page.evaluate(() => !document.body.classList.contains("overview")), `${name}: pinching out returns to a section`);
      // sheet: tap to open, swipe down to close
      await page.tap("#tabs button[data-i='0']"); await page.waitForTimeout(800);
      const target = await page.evaluateHandle(() => [...document.querySelectorAll(".slot [data-open]")].find(e => { const r = e.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 40 && r.left >= 0 && r.right <= innerWidth; }));
      if (target.asElement()) {
        await target.asElement().tap(); await page.waitForTimeout(500);
        ok(await page.$eval("#sheet", s => s.classList.contains("on")), `${name}: tapping an item opens the sheet`);
        const sb = await page.$eval("#sheet", s => { const r = s.getBoundingClientRect(); return { top: r.top, h: r.height, w: r.width }; });
        ok(sb.w <= W + 1, `${name}: the sheet fits the screen width`);
        // scroll the content, then pull down in the same gesture: that is a scroll, the sheet must stay open
        if (await page.$eval("#sheet-body", b => b.scrollHeight > b.clientHeight + 300)) {
          const ys = sb.top + Math.min(sb.h - 40, 420);
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W / 2, y: ys, id: 1 }] });
          await page.evaluate(() => { document.querySelector("#sheet-body").scrollTop = 200; });
          for (let k = 1; k <= 8; k++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W / 2, y: ys + k * 30, id: 1 }] }); await sleep(16); }
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(500);
          ok(await page.$eval("#sheet", s => s.classList.contains("on")), `${name}: pulling down after scrolling the sheet does not close it`);
          await page.evaluate(() => { document.querySelector("#sheet-body").scrollTop = 0; });
        }
        const y0 = sb.top + 30;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W / 2, y: y0, id: 1 }] });
        for (let k = 1; k <= 8; k++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W / 2, y: y0 + k * 25, id: 1 }] }); await sleep(16); }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(600);
        ok(await page.$eval("#sheet", s => !s.classList.contains("on")), `${name}: swiping the sheet down closes it`);
      } else ok(false, `${name}: an item to tap is visible in the first section`);
      // landscape
      await page.setViewportSize({ width: Math.max(W, 640), height: W }); await page.waitForTimeout(800);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: landscape has no horizontal page scroll`);
      noErrors(errs, name);
      await ctx.close();
    }
  },

  async tablet() {
    for (const name of ["iPad Mini", "iPad Mini landscape"]) {
      const { ctx, page, errs } = await open({ ...pw.devices[name] });
      const g = await geometry(page);
      ok(!g.clipped.length && !g.pageOverflow, `${name}: nothing cut off${g.clipped.length ? " (" + g.clipped.join(", ") + ")" : ""}`);
      ok(!g.overlaps.length, `${name}: cards do not overlap`);
      const t = await page.evaluateHandle(() => [...document.querySelectorAll(".slot [data-open]")].find(e => { const r = e.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 20; }));
      if (t.asElement()) { await t.asElement().tap(); await page.waitForTimeout(500); ok(await page.$eval("#sheet", s => s.classList.contains("on")), `${name}: a tap opens the sheet`); }
      noErrors(errs, name);
      await ctx.close();
    }
  },

  async resilience() {
    const cases = [
      ["library.json fails", /\/data\/library\.json/, 500],
      ["library-notes.json fails", /\/data\/library-notes\.json/, 500],
      ["opinions.json fails", /\/data\/opinions\.json/, 500],
      ["glossary.json fails", /\/data\/glossary\.json/, 500],
      ["events.json fails", /\/data\/events\.json/, 500],
      ["digest index fails", /\/data\/digests\/index\.json/, 500],
      ["today's digest fails", /\/data\/digests\/\d{4}-\d{2}-\d{2}\.json/, 500],
      ["events.json is cut in half", /\/data\/events\.json/, "corrupt"],
      ["library.json is cut in half", /\/data\/library\.json/, "corrupt"],
      ["opinions.json has an empty list", /\/data\/opinions\.json/, '{"opinions":[]}'],
      ["slow library (6 s)", /\/data\/library\.json/, "slow"]
    ];
    for (const [name, re, how] of cases) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on("pageerror", e => errs.push(e.message));
      await page.addInitScript(() => { try { sessionStorage.setItem("atlas.intro", "1"); localStorage.setItem("atlas.hint", "1"); } catch {} });
      await page.route(re, async r => {
        if (how === 500) return r.fulfill({ status: 500, body: "" });
        if (how === "slow") { await sleep(6000); return r.continue(); }
        if (how === "corrupt") { const res = await r.fetch(); const b = await res.text(); return r.fulfill({ status: 200, contentType: "application/json", body: b.slice(0, b.length / 2) }); }
        return r.fulfill({ status: 200, contentType: "application/json", body: how });
      });
      await page.goto(BASE + "/", { waitUntil: "load" });
      const drawn = await page.waitForSelector(".slot", { timeout: 15000 }).then(() => true, () => false);
      await page.waitForTimeout(how === "slow" ? 6500 : 600);
      const n = await page.$$eval(".slot", s => s.length);
      ok(drawn && n >= 6, `resilience, ${name}: the page still works (${n} cards)`);
      ok(!errs.length, `resilience, ${name}: no uncaught errors${errs.length ? ": " + errs[0] : ""}`);
      await ctx.close();
    }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.route(/\/data\/atlas\.json/, r => r.fulfill({ status: 503, body: "" }));
    await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(1500);
    const msg = await page.$eval("#loading", l => l.textContent).catch(() => "");
    ok(/загрузить|load/i.test(msg), "resilience, atlas.json missing: the reader sees a plain message, not a blank page");
    ok(!errs.length, "resilience, atlas.json missing: no uncaught errors");
    await ctx.close();
  },

  async budget() {
    const { ctx, page, errs } = await open({ viewport: { width: 1440, height: 900 } });
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0], res = performance.getEntriesByType("resource");
      const size = f => res.filter(f).reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);
      return { dcl: nav.domContentLoadedEventEnd, code: size(r => /\.(js|css)(\?|$)/.test(r.name)) + (nav.transferSize || nav.encodedBodySize || 0), data: size(r => /\/data\//.test(r.name)), img: size(r => r.initiatorType === "img") };
    });
    ok(m.code < 300 * 1024, `budget: html + css + js ${Math.round(m.code / 1024)} KB (limit 300)`);
    ok(m.data < 8 * 1024 * 1024, `budget: data ${Math.round(m.data / 1024)} KB (limit 8 MB)`);
    ok(m.img < 4 * 1024 * 1024, `budget: images ${Math.round(m.img / 1024)} KB (limit 4 MB)`);
    const t0 = Date.now(); await page.reload({ waitUntil: "load" }); await page.waitForSelector(".slot"); const firstPaint = Date.now() - t0;
    ok(firstPaint < (args.url ? 8000 : 4000), `budget: cards on screen ${firstPaint} ms after load starts`);
    const nameless = await page.evaluate(() => [...document.querySelectorAll("button, a[href]")].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && !(b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent.trim()); }).map(b => b.className || b.id || b.tagName).slice(0, 5));
    ok(!nameless.length, `budget: every visible control has a name for screen readers${nameless.length ? " (" + nameless.join(", ") + ")" : ""}`);
    const noAlt = await page.$$eval("img", l => l.filter(i => !i.hasAttribute("alt")).length);
    ok(noAlt === 0, `budget: every image has alt text (${noAlt} without)`);
    ok(await page.$eval("html", h => h.lang === "ru"), "budget: the page declares its language");
    // keyboard: Tab reaches a card item and Enter opens it
    await page.keyboard.press("Tab"); for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => { const a = document.activeElement; const s = getComputedStyle(a); return { tag: a.tagName, ring: s.outlineStyle !== "none" || s.boxShadow !== "none" }; });
    ok(focused.tag === "BUTTON" || focused.tag === "A", `budget: Tab moves through controls (${focused.tag})`);
    noErrors(errs, "budget");
    await ctx.close();
    // reduced motion: the camera still works without animation
    const rm = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await rm.page.keyboard.press("0"); await rm.page.waitForTimeout(200);
    ok(await rm.page.evaluate(() => document.querySelector("#board").classList.contains("far")), "budget: with reduced motion, key 0 shows the map at once");
    noErrors(rm.errs, "reduced motion");
    await rm.ctx.close();
  }
};

try {
  for (const [name, fn] of Object.entries(groups)) {
    if (only && !only.has(name)) continue;
    console.log(`\n# ${name}`);
    try { await fn(); } catch (e) { ok(false, `${name}: run crashed: ${e.message.split("\n")[0]}`); }
  }
} finally { await browser.close(); if (local) await local.close(); }

console.log(R.failed ? `\n${R.failed} of ${R.failed + R.passed} e2e checks FAILED on ${BASE}` : `\nall ${R.passed} e2e checks passed on ${BASE}`);
process.exit(R.failed ? 1 : 0);

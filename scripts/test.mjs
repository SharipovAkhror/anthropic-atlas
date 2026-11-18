#!/usr/bin/env node
// Regression tests for the pipeline guarantees. Run: node scripts/test.mjs
//  1. the real data passes validation;
//  2. the validator rejects typical mistakes a model could make;
//  3. the digest is computed from the data diff (added / updated / removed) and never invents changes;
//  4. pure logic of lib / collect / digest / guard / library on fixed inputs (no network, no git).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tashkentDate, parseArgs, decode, normalizeUrl, sha, isoDay } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (cond, name) => { console.log(`${cond ? "pass" : "FAIL"}  ${name}`); if (!cond) failed++; };
const node = (script, root, args = []) => spawnSync(process.execPath, [join(ROOT, "scripts", script), ...args], { env: { ...process.env, ATLAS_ROOT: root }, encoding: "utf8" });

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "atlas-"));
  for (const d of ["data", "schema", "sources"]) cpSync(join(ROOT, d), join(dir, d), { recursive: true });
  return dir;
}
const edit = (dir, rel, fn) => { const p = join(dir, rel); const j = JSON.parse(readFileSync(p, "utf8")); fn(j); writeFileSync(p, JSON.stringify(j, null, 2)); };
const today = tashkentDate();

// 1. real data
ok(node("validate.mjs", ROOT, ["--quiet"]).status === 0, "repository data is valid");

// 2. validator catches mistakes
const cases = [
  ["future-dated event", d => edit(d, "data/events.json", j => { j.events[0].date = "2999-01-01"; j.events[0].id = "2999-01-01-x"; })],
  ["event without source", d => edit(d, "data/events.json", j => { j.events[0].sources = []; })],
  ["event missing English title", d => edit(d, "data/events.json", j => { delete j.events[0].title.en; })],
  ["unknown event type", d => edit(d, "data/events.json", j => { j.events[0].type = "rumor"; })],
  ["duplicate event id", d => edit(d, "data/events.json", j => { j.events.push({ ...j.events[0] }); })],
  ["unsorted events", d => edit(d, "data/events.json", j => { j.events.reverse(); })],
  ["product owner that does not exist", d => edit(d, "data/atlas.json", j => { j.products[0].owners.push("nobody-here"); })],
  ["former person without end date", d => edit(d, "data/atlas.json", j => { const p = j.people.find(x => x.status === "active"); p.status = "former"; })],
  ["blocked low-quality source", d => edit(d, "data/atlas.json", j => { j.people[0].sources = [{ title: "x", url: "https://www.reddit.com/r/x" }]; })],
  ["http (not https) source", d => edit(d, "data/atlas.json", j => { j.people[0].sources = [{ title: "x", url: "http://example.com" }]; })],
  ["edge to missing node", d => edit(d, "data/atlas.json", j => { j.edges.push({ from: "dario-amodei", to: "ghost", type: "rep" }); })],
  ["unknown field (typo)", d => edit(d, "data/atlas.json", j => { j.people[0].rol = "x"; })],
  ["broken JSON", d => writeFileSync(join(d, "data/events.json"), "{ \"events\": [ ")],
  ["library item dated in the future", d => edit(d, "data/library.json", j => { j.items[0].date = "2999-01-01"; })],
  ["library duplicate url", d => edit(d, "data/library.json", j => { j.items[1].url = j.items[0].url; })],
  ["library emptied by a broken source", d => edit(d, "data/library.json", j => { j.items = j.items.slice(0, 50); })],
  ["library card with an unknown audience", d => edit(d, "data/library-notes.json", j => { const k = Object.keys(j.notes)[0]; j.notes[k].w = ["aliens"]; })],
  ["reading path pointing at a missing item", d => edit(d, "data/library-notes.json", j => { j.paths[0].items[0].id = "0000000000"; })],
  ["a date that is not on the calendar", d => edit(d, "data/atlas.json", j => { j.facts[0].asOf = "2026-02-31"; })],
  ["Russian text that is only spaces", d => edit(d, "data/events.json", j => { j.events[0].summary.ru = "   "; })],
  ["two people with the same name", d => edit(d, "data/atlas.json", j => { j.people[1].name = j.people[0].name; })],
  ["a person who left before joining", d => edit(d, "data/atlas.json", j => { const p = j.people.find(x => x.status === "former" && x.since); p.until = "1999"; })],
  ["digest index out of order", d => edit(d, "data/digests/index.json", j => { j.digests.reverse(); })],
  ["digest index count that disagrees with the digest", d => edit(d, "data/digests/index.json", j => { j.digests[0].counts.library += 5; })],
  ["events.json with the wrong shape (no crash, an error)", d => writeFileSync(join(d, "data/events.json"), "[]")]
];
for (const [name, mutate] of cases) {
  const d = sandbox();
  try { mutate(d); const r = node("validate.mjs", d, ["--quiet"]); ok(r.status === 1 && /FAILED/.test(r.stdout), `validator rejects: ${name}`); } finally { rmSync(d, { recursive: true, force: true }); }
}

// 3. digest from diff
{
  const d = sandbox();
  try {
    const git = (...a) => execFileSync("git", a, { cwd: d, stdio: "ignore" });
    git("init", "-q"); git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"); git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
    edit(d, "data/events.json", j => { j.events.unshift({ id: `${today}-test-event`, date: today, type: "product", importance: 2, title: { ru: "Тест", en: "Test" }, summary: { ru: "Тест." }, sources: [{ title: "Anthropic", url: "https://www.anthropic.com/news" }], addedAt: today }); });
    let retired;
    edit(d, "data/atlas.json", j => { const p = j.people.find(x => x.status === "active" && x.kind === "person" && x.id !== "dario-amodei"); retired = p.id; p.status = "former"; p.until = today.slice(0, 7); j.people.find(x => x.id === "dario-amodei").bio = { ru: "Изменено." }; });
    const r = node("digest.mjs", d, [`--date=${today}`, "--fresh"]);
    const dg = JSON.parse(readFileSync(join(d, `data/digests/${today}.json`), "utf8"));
    ok(r.status === 0, "digest runs");
    ok(dg.news.length === 1 && dg.news[0] === `${today}-test-event`, "digest lists exactly the new event");
    ok(dg.removed.length === 1 && dg.removed[0].id === retired, "digest reports the departure as removed");
    ok(dg.updated.length === 1 && dg.updated[0].id === "dario-amodei" && dg.updated[0].fields.includes("bio"), "digest reports the edited field");
    ok(dg.added.length === 0, "digest invents no additions");
    ok(node("validate.mjs", d, ["--quiet"]).status === 0, "data + digest still valid after the run");
    // second run the same day extends the digest instead of replacing it
    git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"); git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "run1");
    edit(d, "data/events.json", j => { j.events.unshift({ id: `${today}-second-event`, date: today, type: "people", importance: 1, title: { ru: "Второе", en: "Second" }, summary: { ru: "Второе." }, sources: [{ title: "Anthropic", url: "https://www.anthropic.com/company" }], addedAt: today }); });
    node("digest.mjs", d, [`--date=${today}`]);
    const dg2 = JSON.parse(readFileSync(join(d, `data/digests/${today}.json`), "utf8"));
    ok(dg2.news.length === 2 && dg2.removed.length === 1 && dg2.updated.length === 1, "same-day re-run keeps earlier findings and adds new ones");
    ok(node("validate.mjs", d, ["--quiet"]).status === 0, "after a re-run the digest index counts match the digest");
    const raw2 = readFileSync(join(d, `data/digests/${today}.json`), "utf8");
    node("digest.mjs", d, [`--date=${today}`]);
    ok(readFileSync(join(d, `data/digests/${today}.json`), "utf8") === raw2, "a re-run with nothing new leaves the digest file identical (no second Telegram message)");
    // library cards: one bad card is skipped, the good one in the same batch is kept
    const libIds = JSON.parse(readFileSync(join(d, "data/library.json"), "utf8")).items.filter(i => !i.gone).map(i => i.id);
    const notesNow = JSON.parse(readFileSync(join(d, "data/library-notes.json"), "utf8")).notes;
    const free = libIds.filter(id => !notesNow[id]).slice(0, 3);
    if (free.length === 3) {
      const cardsFile = join(d, "cards.json");
      writeFileSync(cardsFile, JSON.stringify({ [free[0]]: { t: "Обзор", s: "Короткое описание материала." }, [free[1]]: { t: "  ", s: "Пустой заголовок." }, [free[2]]: { t: "Great news!", s: "Totally amazing release!!!" } }));
      const rc = node("library-notes.mjs", d, [`--add=${cardsFile}`]);
      const after = JSON.parse(readFileSync(join(d, "data/library-notes.json"), "utf8")).notes;
      ok(rc.status === 0 && after[free[0]] && !after[free[1]] && !after[free[2]], "library cards: a blank or hype card is skipped, the good one in the batch is kept");
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// 4. mass-deletion guard: a commit that drops records is refused
{
  const d = sandbox();
  try {
    const git = (...a) => execFileSync("git", a, { cwd: d, stdio: "ignore" });
    git("init", "-q"); git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"); git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
    ok(node("guard.mjs", d, ["--base=HEAD"]).status === 0, "guard passes when nothing was removed");
    edit(d, "data/events.json", j => { j.events = j.events.slice(10); });
    ok(node("guard.mjs", d, ["--base=HEAD"]).status === 1, "guard refuses ten events removed without archiving");
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// 5. autonomy: a day with only new official posts (no model, no events) still gets a real digest and feed
{
  const d = sandbox();
  try {
    const git = (...a) => execFileSync("git", a, { cwd: d, stdio: "ignore" });
    git("init", "-q"); git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"); git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
    let id;
    edit(d, "data/library.json", j => { const it = j.items.find(i => i.section === "news" && !i.gone); it.added = today; it.date = today; id = it.id; });
    const r = node("digest.mjs", d, [`--date=${today}`, "--fresh"]);
    const dg = JSON.parse(readFileSync(join(d, `data/digests/${today}.json`), "utf8"));
    ok(r.status === 0 && dg.library.includes(id), "digest lists the new official post without a model");
    ok(dg.headline.ru !== "Без существенных новостей", "digest headline names the new post");
    ok(/<rss/.test(readFileSync(join(d, "data/feed.xml"), "utf8")), "RSS feed is written");
    ok(node("validate.mjs", d, ["--quiet"]).status === 0, "autonomous digest is valid");
  } finally { rmSync(d, { recursive: true, force: true }); }
}

// 6. library parsers for sources that may be unreachable from a dev sandbox (checked on fixed sample markup)
{
  const L = await import("./library.mjs");
  const idx = `<h2>November 2026</h2><a class="note" href="/2026/worse-together/"><h3>Worse Together: How Performance Breaks Down in Multi-User Multi-Agent Teams</h3><div class="byline">Doe et al., 2026</div><div class="description">We study what happens when several users' agents share a resource.</div></a>
    <a href="https://www.anthropic.com/research/alignment-faking"><h3>Alignment faking</h3></a><a href="https://arxiv.org/abs/2506.18032">paper</a>
    <div class="date">April 2022</div><a href="2022/old-post/index.html"><h3>Old post</h3><p>An older post description that is long enough.</p></a><a href="#top">top</a>`;
  const a = L.monthIndex(idx, "https://alignment.anthropic.com/", { section: "research", team: ["alignment"] });
  ok(a.length === 2 && a[0].url === "https://alignment.anthropic.com/2026/worse-together" && a[0].date === "2026-11-01" && a[0].team[0] === "alignment" && /share a resource/.test(a[0].desc) && a[0].title.startsWith("Worse Together"), "library: month-index parser reads same-host posts with month dates");
  ok(a[1].date === "2022-04-01" && a[1].title === "Old post", "library: month-index parser handles relative links and later headings");
  const tc = L.monthIndex(`<div class="date">March 2020 - April 2021</div><a class="paper" href="2021/framework/index.html"><h3>A Mathematical Framework for Transformer Circuits</h3><div class="description">Early framework.</div></a>`, "https://transformer-circuits.pub/", { section: "research", team: ["interpretability"] });
  ok(tc.length === 1 && tc[0].date === "2021-04-01" && tc[0].url === "https://transformer-circuits.pub/2021/framework/index.html", "library: circuits range heading dated by its end month");
  const sk = L.skilljar(`<a href="/claude-code-in-action" class="coursebox-container"><div class="coursebox-text">Claude Code in Action</div><div class="coursebox-text-description">Run long Claude Code sessions.</div></a><a href="/auth/login">Sign in</a>`);
  ok(sk.length === 1 && sk[0].url === "https://anthropic.skilljar.com/claude-code-in-action" && sk[0].title === "Claude Code in Action" && sk[0].desc === "Run long Claude Code sessions.", "library: skilljar catalog parser");
  const cb = L.cookbook(`# c\n- title: 'Managed Agents tutorial: x'\n  description: Line one\n    continues here.\n  path: managed_agents/x.ipynb\n  authors:\n  - someone\n  date: '2999-01-01'\n  categories:\n  - Tools\n- title: Second\n  path: misc/y.ipynb\n  date: '2025-01-02'\n`);
  ok(cb.length === 2 && cb[0].title === "Managed Agents tutorial: x" && cb[0].desc === "Line one continues here." && !cb[0].date && cb[0].group === "Tools" && cb[1].date === "2025-01-02", "library: cookbook registry parser (future dates dropped)");
  const mcp = L.mcpDocs(["- [Intro](https://modelcontextprotocol.io/docs/2025-06-18/intro.md)", "- [Intro](https://modelcontextprotocol.io/docs/2025-11-25/intro.md): New", "- [Intro](https://modelcontextprotocol.io/docs/draft/intro.md)", "- [Examples](https://modelcontextprotocol.io/examples.md)", "- [Examples](https://modelcontextprotocol.io/examples.md)"].join("\n"));
  ok(mcp.length === 2 && mcp[0].url === "https://modelcontextprotocol.io/docs/2025-11-25/intro" && mcp[0].desc === "New", "library: MCP llms.txt keeps only the newest released version");
  const hc = L.helpCenter(`<urlset><url><loc>https://support.claude.com/de/articles/1-x</loc></url><url><loc>https://support.claude.com/en/articles/7996845-what-can-i-use-claude-for</loc><lastmod>2026-03-12T16:51:22Z</lastmod></url><url><loc>https://support.claude.com/en/collections/4078531-claude</loc></url></urlset>`,
    `<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"v2Navbar":{"collections":[{"name":"Claude","articles":[],"subcollections":[{"name":"Get started","articles":[{"title":"What are some things I can use Claude for?","url":"https://support.claude.com/en/articles/7996845-what-can-i-use-claude-for"}]}]}]}}}}</script>`);
  const ac = L.academy(`<h2>Start your journey</h2><a href="/courses/claude-101"><h3>Claude 101</h3><p>Learn how to use Claude for everyday work tasks.</p></a><a href="/products/claude">Claude</a>`, "https://academy.claude.com/");
  ok(ac.length === 1 && ac[0].url === "https://academy.claude.com/courses/claude-101" && ac[0].group === "Academy: Start your journey", "library: academy.claude.com catalog parser");
  const sc = L.cards(`<a href="https://anthropic.com/claude-opus-5-system-card">Claude Opus 5</a><a href="http://anthropic.com/claude-sonnet-4-6-system-card">Claude Sonnet 4.6</a><a href="https://assets.claude.com/abc.pdf">Claude 2</a><a href="https://web.archive.org/web/1/https://www.anthropic.com/x">system card</a><a href="/transparency/model-report">01Model Report</a>`, "system-cards");
  ok(sc.length === 4 && sc[0].url === "https://www.anthropic.com/claude-opus-5-system-card" && sc[0].title === "Claude Opus 5 system card" && sc[1].url.startsWith("https://www.") && sc[2].section === "models" && sc[3].section === "policy" && sc[3].title === "Model Report", "library: system cards and transparency pages");
  ok(!L.keep("javascript://x/research/a") && !L.keep("http://www.anthropic.com/a") && !L.keep("https://github.com/someone/x") && L.keep("https://github.com/anthropics/courses"), "library: only https links on allowed hosts");
  ok(L.cleanTitle("Adalat AI Claude Platform (API) case study") === "Adalat AI" && L.cleanTitle("Pricing | Claude by Anthropic") === "Pricing", "library: site suffixes are stripped from titles");
  ok(L.monthIndex(`<h2>May 2025</h2><a href="/2025/x/"><h3>T &#99999999; &#55296; ok</h3></a>`, "https://alignment.anthropic.com/", { section: "research" })[0]?.title === "T ok", "library: bad numeric entities do not crash decoding");
  ok(hc.length === 1 && hc[0].title === "What are some things I can use Claude for?" && hc[0].group === "Claude" && hc[0].lastmod === "2026-03-12", "library: help center keeps English articles with collection groups");
}

// 7. shared helpers
{
  ok(JSON.stringify(parseArgs(["--date=2026-01-02", "--dry", "--only=a,b"])) === JSON.stringify({ date: "2026-01-02", dry: true, only: "a,b" }), "lib: parseArgs reads --key=value and bare flags");
  ok(tashkentDate(new Date("2026-03-01T20:30:00Z")) === "2026-03-02" && tashkentDate(new Date("2026-03-01T18:59:00Z")) === "2026-03-01", "lib: tashkentDate rolls over at 19:00 UTC");
  ok(isoDay(Date.parse("2026-03-10T23:59:59Z") - 864e5) === "2026-03-09", "lib: isoDay");
  ok(decode("<![CDATA[A &amp; B]]> &#8211; &#x41; &#99999999; &#55296; &quot;q&quot;") === 'A & B – A   "q"', "lib: decode handles CDATA, entities and invalid code points");
  ok(normalizeUrl("http://x.com/a/b.md") === "https://x.com/a/b" && normalizeUrl("https://x.com/a/") === "https://x.com/a", "lib: normalizeUrl strips .md, trailing slash, http");
  ok(sha("a").length === 10 && sha("a", 12).length === 12 && sha("a") === sha("a") && sha("a") !== sha("b"), "lib: sha length and determinism");
}

// 8. collector parsers
{
  const C = await import("./collect.mjs");
  const now = Date.parse("2026-11-18T00:00:00Z");
  const rss = `<rss><channel><item><title>Fresh &amp; new</title><link>https://a.example/1</link><pubDate>Tue, 17 Nov 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Hello <b>world</b></p>]]></description><source url="x">Outlet</source></item>
    <item><title>Old</title><link>https://a.example/2</link><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate></item><item><title>No link</title></item>
    <item><title>Undated</title><link>https://a.example/3</link></item></channel></rss>`;
  const f = C.parseFeed(rss, now, 3);
  ok(f.length === 2 && f[0].title === "Fresh & new" && f[0].snippet === "Hello world" && f[0].outlet === "Outlet" && f[1].published === null, "collect: RSS keeps fresh and undated items, drops old ones and items without a link");
  const atom = C.parseFeed(`<feed><entry><title>T</title><link href="https://b.example/x"/><updated>2026-11-17T10:00:00Z</updated><summary>S</summary></entry></feed>`, now, 3);
  ok(atom.length === 1 && atom[0].url === "https://b.example/x" && atom[0].snippet === "S", "collect: Atom entries are read (link href, updated, summary)");
  const lines = C.strip("<h2>November 5, 2026</h2><p>Added thing</p><p>Added thing</p><h2>October 30, 2026</h2><li>Older</li><script>x()</script>");
  ok(JSON.stringify(lines) === JSON.stringify(["November 5, 2026", "Added thing", "Added thing", "October 30, 2026", "Older"]), "collect: strip splits blocks into lines and drops scripts");
  const secs = C.parseDatedHeadings(lines);
  ok(secs.length === 2 && secs[0].date === "2026-11-05" && secs[0].text.length === 1 && secs[1].text[0] === "Older", "collect: dated headings group lines and de-duplicate repeats");
  const parts = C.parseChangelog("# Changelog\n## 2.0.3\n- c\nnote\n## 2.0.2\n- b\n## 2.0.1\n- a\n");
  ok(parts.length === 3 && parts[0].version === "2.0.3" && parts[0].body === "- c", "collect: changelog parser keeps only bullet lines");
  ok(C.newerVersions(parts, "2.0.2").length === 1 && C.newerVersions(parts, "9.9.9").length === 3 && C.newerVersions(parts, "2.0.3").length === 0, "collect: newer versions after the cursor (unknown cursor caps at five)");
  const pl = C.pageLines("<p>Accept all cookies</p><p>Real headline here</p><p>ab</p><p>© 2026 Anthropic</p>");
  ok(pl.length === 1 && pl[0] === "Real headline here", "collect: page-watch ignores banners, copyright and tiny lines");
  const dl = C.diffLines(["a", "b", ""], ["b", "c"]);
  ok(dl.added.join() === "c" && dl.removed.join() === "a", "collect: page diff lists added and removed lines");
}

// 9. digest logic
{
  const D = await import("./digest-core.mjs");
  const lab = x => x.id;
  const before = [{ id: "a", status: "active", v: 1, verifiedAt: "2026-01-01" }, { id: "b", status: "active" }, { id: "c", status: "active" }, { id: "d", status: "active", verifiedAt: "2026-01-01" }, { id: "e", status: "active", links: {} }];
  const after = [{ id: "a", status: "active", v: 2, verifiedAt: "2026-02-01" }, { id: "b", status: "former" }, { id: "d", status: "active", verifiedAt: "2026-02-02" }, { id: "e", status: "active", links: { wikipedia: "x" } }, { id: "n", status: "active" }];
  const r = D.diff("person", before, after, lab, { c: "left the company" });
  ok(r.added.map(x => x.id).join() === "n", "digest: new ids are additions");
  ok(r.updated.length === 1 && r.updated[0].id === "a" && r.updated[0].fields.join() === "v", "digest: a changed field is an update; re-verification date alone is not");
  ok(r.removed.map(x => x.id).sort().join() === "b,c" && r.removed.find(x => x.id === "c").reason === "left the company" && r.removed.find(x => x.id === "b").reason === "status → former", "digest: retired status and vanished ids are removals with a reason");
  ok(r.reverified.join() === "d", "digest: only a verifiedAt change counts as re-verified; enrichment links are ignored");
  ok(D.diff("x", undefined, [{ id: "z" }], lab).added.length === 1, "digest: missing base list means everything is new");
  ok(D.plural(1, "а", "б", "в") === "1 а" && D.plural(2, "а", "б", "в") === "2 б" && D.plural(5, "а", "б", "в") === "5 в" && D.plural(11, "а", "б", "в") === "11 в" && D.plural(21, "а", "б", "в") === "21 а" && D.plural(112, "а", "б", "в") === "112 в", "digest: Russian plural forms");
  ok(D.ru({ ru: "р", en: "e" }) === "р" && D.ru({ en: "e" }) === "e" && D.ru("s") === "s" && D.ru(null) === "" && D.hasRu({ ru: " " }) === false && D.hasRu({ ru: "x" }) === true, "digest: ru() fallback and hasRu()");
  const idx = { digests: [{ date: "2026-11-18", headline: { ru: "A <b> & \u0001" }, counts: { news: 1 } }, { date: "2026-11-17", headline: { ru: "quiet" }, counts: { news: 0, added: 0 } }] };
  const xml = D.feedXml(idx, d => (d === "2026-11-18" ? { summary: { ru: "S" }, generatedAt: "2026-11-18T01:00:00Z" } : null), "https://s.example", new Date("2026-11-18T02:00:00Z"));
  ok((xml.match(/<item>/g) || []).length === 1 && xml.includes("A &lt;b&gt; &amp; ") && !xml.includes("\u0001") && xml.includes("<description>S</description>") && xml.includes("https://s.example/data/feed.xml"), "digest: feed lists only busy days and escapes XML");
}

// 10. guard logic
{
  const G = await import("./guard.mjs");
  const arch = new Set(["x"]);
  ok(G.lostIds(["a", "b", "x"], ["a"], arch).join() === "b", "guard: archived ids are not counted as lost");
  ok(G.liveDropped({ items: Array(10).fill({}) }, { items: Array(8).fill({}) })?.to === 8 && G.liveDropped({ items: Array(10).fill({}) }, { items: [...Array(9).fill({}), { gone: "x" }] }) === null, "guard: more than 10% fewer live library items is flagged; `gone` items do not count as live");
  ok(G.shrankPercent({ a: "x".repeat(100) }, { a: "x".repeat(70) }) > 0 && G.shrankPercent({ a: "x".repeat(100) }, { a: "x".repeat(90) }) === 0, "guard: a file shrinking by more than 20% is flagged");
  const mk = ids => ({ events: ids.map(id => ({ id })) });
  const snap = id => ({ kind: "event", id, snapshot: { id, title: { ru: "x" } } });
  const run = (old, cur, maxRemoved = 3) => G.runGuard({ old: r => old[r] || null, cur: r => cur[r] || null, base: "B", maxRemoved });
  const ev6 = { "data/events.json": mk(["1", "2", "3", "4", "5", "6"]) };
  const r1 = run(ev6, { "data/events.json": mk(["2", "3", "4", "5", "6"]) });
  ok(r1.compared === 1 && r1.errors.some(e => /^data\/events\.json: 1 events removed without archiving \(limit 0\)/.test(e)), "guard: even one event removed without archiving fails");
  ok(run(ev6, { "data/events.json": mk(["2", "3", "4", "5", "6"]), "data/archive.json": { items: [snap("1")] } }).errors.length === 0, "guard: a removal with a real archive snapshot passes");
  ok(run(ev6, { "data/events.json": mk(["2", "3", "4", "5", "6"]), "data/archive.json": { items: [{ kind: "event", id: "1", snapshot: {} }] } }).errors.length === 1, "guard: an empty archive stub does not excuse a removal");
  ok(run({ ...ev6, "data/archive.json": { items: [snap("9")] } }, { ...ev6, "data/archive.json": { items: [] } }).errors.some(e => /append-only/.test(e)), "guard: deleting an archive entry fails");
  ok(run({ "data/opinions.json": { opinions: [{ id: "a" }, { id: "b" }] } }, { "data/opinions.json": { opinions: [{ id: "a" }] } }).errors.length > 0, "guard: opinions are protected too");
  const cards = n => ({ notes: Object.fromEntries([...Array(n)].map((_, i) => [`c${i}`, { t: "x" }])), paths: [] });
  ok(run({ "data/library-notes.json": cards(40) }, { "data/library-notes.json": cards(38) }).errors.length === 0, "guard: a few library cards may go (pages move)");
  ok(run(ev6, {}).errors.some(e => /was deleted/.test(e)), "guard: a deleted data file fails");
}

// 10b. source link checker: only real disappearance counts as dead
{
  const K = await import("./links.mjs");
  ok(K.verdict(404) === "dead" && K.verdict(410) === "dead" && K.verdict(0, "ENOTFOUND") === "dead", "links: 404, 410 and an unknown host are dead");
  ok(K.verdict(403) === "unsure" && K.verdict(429) === "unsure" && K.verdict(503) === "unsure" && K.verdict(0, "ETIMEDOUT") === "unsure" && K.verdict(200) === "ok" && K.verdict(301) === "ok", "links: robots refusals, outages and timeouts are only unsure");
  const m = K.collectSources({ atlas: { people: [{ id: "p", sources: [{ url: "https://a.example/x" }] }], products: [], facts: [{ id: "f", sources: [{ url: "https://a.example/x" }, { url: "mailto:x" }] }] }, events: { events: [{ id: "e", sources: [{ url: "https://b.example" }] }] } });
  ok(m.size === 2 && m.get("https://a.example/x").join() === "person/p,fact/f", "links: each url is checked once and remembers every place it is cited");
}

// 11. library classification
{
  const L = await import("./library.mjs");
  ok(L.classifyAnthropic("/news/claude-opus-5") === "models" && L.classifyAnthropic("/news/anthropic-raises") === "news" && L.classifyAnthropic("/news/updated-usage-policy") === "policy", "library: /news posts are classified into models / news / policy");
  ok(L.classifyAnthropic("/research/economic-index-x") === "institute" && L.classifyAnthropic("/research/alignment-faking") === "research" && L.classifyAnthropic("/research/team/alignment") === null && L.classifyAnthropic("/research") === null, "library: research posts, team pages and indexes");
  ok(L.classifyAnthropic("/legal/aup") === "legal" && L.classifyAnthropic("/events/x") === "events" && L.classifyAnthropic("/careers") === null, "library: legal, events and unknown paths");
  ok(L.classifyClaude("/resources/articles/x") === "guides" && L.classifyClaude("/customers/acme") === "customers" && L.classifyClaude("/product/claude-code") === "models" && L.classifyClaude("/pricing") === null, "library: claude.com sections");
  const l = L.llms("## English\n### Guides\n- [Intro](https://docs.claude.com/en/intro.md): First\n- [German](https://docs.claude.com/de/intro.md)\n### API Reference\n- [Ep](https://docs.claude.com/en/api/ep.md)\n## Deutsch\n### Guides\n- [X](https://docs.claude.com/en/x.md)\n", "docs-api");
  ok(l.length === 1 && l[0].url === "https://docs.claude.com/en/intro" && l[0].group === "Guides" && l[0].desc === "First", "library: API llms.txt keeps English guides, skips reference and other languages");
  const lc = L.llms("### Setup\n- [Install](https://code.claude.com/docs/en/setup.md) - How to install\n", "docs-code");
  ok(lc.length === 1 && lc[0].desc === "How to install" && lc[0].group === "Setup", "library: Claude Code llms.txt line with dash description");
  const sm = L.locs("<urlset><url><loc>https://a.example/x</loc><lastmod>2026-01-02T10:00:00Z</lastmod></url><url><loc>https://a.example/y</loc></url></urlset>");
  ok(sm.length === 2 && sm[0].lastmod === "2026-01-02" && sm[1].lastmod === null, "library: sitemap locs with and without lastmod");
}

console.log(failed ? `\n${failed} test(s) FAILED` : "\nall tests passed");
process.exit(failed ? 1 : 0);

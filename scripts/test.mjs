#!/usr/bin/env node
// Regression tests for the pipeline guarantees. Run: node scripts/test.mjs
//  1. the real data passes validation;
//  2. the validator rejects typical mistakes a model could make;
//  3. the digest is computed from the data diff (added / updated / removed) and never invents changes.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });

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
  ["reading path pointing at a missing item", d => edit(d, "data/library-notes.json", j => { j.paths[0].items[0].id = "0000000000"; })]
];
for (const [name, mutate] of cases) {
  const d = sandbox();
  try { mutate(d); ok(node("validate.mjs", d, ["--quiet"]).status === 1, `validator rejects: ${name}`); } finally { rmSync(d, { recursive: true, force: true }); }
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

// 5. library parsers for sources that may be unreachable from a dev sandbox (checked on fixed sample markup)
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

console.log(failed ? `\n${failed} test(s) FAILED` : "\nall tests passed");
process.exit(failed ? 1 : 0);

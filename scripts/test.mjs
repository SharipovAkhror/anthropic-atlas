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
const today = new Date().toISOString().slice(0, 10);

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
  ["broken JSON", d => writeFileSync(join(d, "data/events.json"), "{ \"events\": [ ")]
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

console.log(failed ? `\n${failed} test(s) FAILED` : "\nall tests passed");
process.exit(failed ? 1 : 0);

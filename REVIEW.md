# REVIEW.md: what a reviewer (human or model) must check before anything reaches main

CLAUDE.md and AGENTS.md say how to work. This file says what must be true for a change to be accepted.
The hard rules are also enforced by code (CI, hooks, scripts), because written rules alone get skipped.

## Blocking: reject the change if any of these is true
1. **A claim without a source.** Every new or changed fact, event, person or product cites a page that was
   actually opened. Tier 1–2 only (see docs/METHODOLOGY.md). Never news.google.com.
   *Enforced:* `scripts/validate.mjs` (sources present, blocked domains).
2. **Data disappeared.** People, products, facts, events, terms or library items vanished without an entry in
   `data/archive.json`, or a data file shrank by more than 20%.
   Even one record of a guarded set needs an archive entry with a real snapshot; the archive only grows.
   *Enforced:* `scripts/guard.mjs` in CI, in the publish workflow and in the Claude Code edit hook.
3. **The site breaks.** Any page error, a missing core island, horizontal scroll on a phone.
   *Enforced:* `scripts/smoke.mjs` (real Chromium, laptop + iPhone) in CI and every hour against production;
   `scripts/e2e.mjs` (the full suite, docs/TESTING.md) in CI and every night against production.
4. **The daily job touched code.** Commits starting `atlas-daily:` may change only `data/` and `pipeline/`.
   *Enforced:* `publish-daily.yml`.
5. **Hand-edited generated files.** `data/digests/*` come only from `scripts/digest.mjs`; `data/library.json`
   only from `scripts/library.mjs`; library cards only through `scripts/library-notes.mjs --add`.
6. **History rewritten.** No force-push, no direct push to main from an agent.
   *Enforced:* `.claude/settings.json` PreToolUse hook; branch protection is recommended on GitHub.

## Important: fix before merging unless there is a stated reason
- Russian text reads naturally; product names stay in English; no hype words, no exclamation marks, no em dashes.
- Summaries say only what the source says. A model's guess is not a summary.
- New UI follows the design rules in AGENTS.md: neutral surfaces, one accent, no coloured dots, no new top-bar buttons,
  everything works by touch on a 390 px phone.
- New data shapes get a JSON Schema in `schema/` and a validator rule.

## Nice to have (never blocks)
- Smaller diffs, fewer files touched, comments that say *why*.

## How to review quickly
```bash
npm run check        # schema + integrity + regression tests
node scripts/guard.mjs --base=origin/main
node scripts/smoke.mjs
node scripts/e2e.mjs   # site changes
```

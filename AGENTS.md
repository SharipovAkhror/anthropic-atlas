# AGENTS.md — Anthropic Atlas

Static site + daily data pipeline that monitors Anthropic from public sources.
Production: https://anthropic-atlas.vercel.app (Vercel, deploys from `main`).

## Read first
- `RUNBOOK.md` — the daily update procedure (what the morning model does, step by step).
- `docs/METHODOLOGY.md` — sources, data model, modularity, pipeline, quality gates.
- `docs/TESTING.md` — the testing team: what each automated check proves, when it runs, the Claude tester roles.

## Layout
| Path | What |
|---|---|
| `index.html`, `assets/app.css`, `assets/app.js` | the site (no build step; vanilla JS) |
| `data/` | all content: `atlas.json`, `events.json`, `glossary.json`, `modules.json`, `archive.json`, `digests/`, `library.json` (catalog of every public Anthropic page, generated), `library-notes.json` (Russian cards and reading paths) |
| `schema/` | JSON Schemas for every data file |
| `sources/sources.json` | source registry (tiers, trusted press, blocked domains) |
| `sources/wiki-overrides.json` | curated Wikipedia candidates for portraits/links |
| `scripts/` | `collect` (sources → inbox), `library` (catalog, no model), `library-notes` (add cards), `today` (worklist), `validate`, `guard` (no data loss), `smoke` (real browser, quick), `e2e` (full browser suite: screens, phones, touch, every card, missing data), `links` (source link health), `webtest` (shared browser helpers), `digest` (+ `digest-core`, its pure logic), `translate` (Uzbek for everything, Russian cards for new library pages; free GitHub Models, checked), `enrich` (photos, Wikipedia), `lib` (shared helpers: args, Tashkent date, JSON, decode, fetch), `test`, `hooks/` (Claude Code hooks) |
| `pipeline/` | collector state, inbox, watched-page snapshots, run notes (not deployed) |
| `.github/workflows/` | `collect.yml` (05:40 Tashkent: news inbox + library catalog), `publish-daily.yml` (merge daily branch), `validate.yml` (CI), `health.yml` (hourly production check, auto-revert of a broken data commit), `qa.yml` (nightly full browser suite on production, collector streaks, Sunday link check; opens a `qa` issue), `translate.yml` (06:25, 08:40, 15:00 Tashkent: missing Uzbek and Russian texts) |
| `.claude/agents/` | `atlas-daily`, ten `researcher-*` roles (Haiku), three `qa-*` testers (see docs/TESTING.md) |

## Rules
- Read `REVIEW.md`: the blocking rules every change must pass, and which script enforces each.
- Every claim needs a source in `sources[]`; tier 1–2 only (see methodology). Never cite news.google.com.
- Run `npm run check` (validate + tests + guard) and `npm run smoke` after any change, and `npm run e2e` after any change to the site; CI runs them all. A fixed bug gets a check in `e2e.mjs` or `test.mjs`. `npm test` alone runs only the regression suite.
- Scripts export their pure functions (guarded by `isMain` from `scripts/lib.mjs`) so `scripts/test.mjs` can test them without network or git. Put a helper used by two scripts into `scripts/lib.mjs`.
- Do not hand-edit `data/digests/*`; `scripts/digest.mjs` generates them from the data diff.
- Text fields: `ru` required, `en` required for titles/roles/labels, `uz` optional: `scripts/translate.mjs` fills it
  (falls back to ru until then). Never write Cyrillic into `uz`. Write a hand-made `uz` only if you are sure of it;
  the translator never overwrites one. Library cards: `u` is the Uzbek card, `m: 1` marks a machine Russian card.
- Design: neutral surfaces, one accent, few controls. Interactions are hidden and discoverable (hover reveals,
  click-to-expand, ⌘K search, `L` language, `T` theme, swipe to close). Do not add buttons to the top bar.
- Local preview: `python3 -m http.server 4173` and open http://localhost:4173.

## Who the page is for (keep every change answering this)
Russian-speaking readers who act on Anthropic news: API developers (models, prices, deprecations), IPO followers
(numbers with dates, who controls votes), writers and channel authors (a claim, its date, its primary source, copied in
one tap). The first screen answers "what changed, by topic, since my last visit". Every sheet has three actions:
Save (this browser only), Copy with source, Link. Section order and one-line leads live in `data/modules.json`.

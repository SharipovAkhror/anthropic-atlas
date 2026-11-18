# AGENTS.md — Anthropic Atlas

Static site + daily data pipeline that monitors Anthropic from public sources.
Production: https://anthropic-atlas.vercel.app (Vercel, deploys from `main`).

## Read first
- `RUNBOOK.md` — the daily update procedure (what the morning model does, step by step).
- `docs/METHODOLOGY.md` — sources, data model, modularity, pipeline, quality gates.

## Layout
| Path | What |
|---|---|
| `index.html`, `assets/app.css`, `assets/app.js` | the site (no build step; vanilla JS) |
| `data/` | all content: `atlas.json`, `events.json`, `glossary.json`, `modules.json`, `archive.json`, `digests/`, `library.json` (catalog of every public Anthropic page, generated), `library-notes.json` (Russian cards and reading paths) |
| `schema/` | JSON Schemas for every data file |
| `sources/sources.json` | source registry (tiers, trusted press, blocked domains) |
| `sources/wiki-overrides.json` | curated Wikipedia candidates for portraits/links |
| `scripts/` | `collect` (sources → inbox), `library` (catalog, no model), `library-notes` (add cards), `today` (worklist), `validate`, `guard` (no data loss), `smoke` (real browser), `digest` (+ `digest-core`, its pure logic), `enrich` (photos, Wikipedia), `lib` (shared helpers: args, Tashkent date, JSON, decode, fetch), `test`, `hooks/` (Claude Code hooks) |
| `pipeline/` | collector state, inbox, watched-page snapshots, run notes (not deployed) |
| `.github/workflows/` | `collect.yml` (05:40 Tashkent: news inbox + library catalog), `publish-daily.yml` (merge daily branch), `validate.yml` (CI), `health.yml` (hourly production check, auto-revert of a broken data commit) |
| `.claude/agents/` | `atlas-daily` and ten `researcher-*` roles (Haiku) |

## Rules
- Read `REVIEW.md`: the blocking rules every change must pass, and which script enforces each.
- Every claim needs a source in `sources[]`; tier 1–2 only (see methodology). Never cite news.google.com.
- Run `npm run check` (validate + tests + guard) and `npm run smoke` after any change; CI runs them too. `npm test` alone runs only the regression suite.
- Scripts export their pure functions (guarded by `isMain` from `scripts/lib.mjs`) so `scripts/test.mjs` can test them without network or git. Put a helper used by two scripts into `scripts/lib.mjs`.
- Do not hand-edit `data/digests/*`; `scripts/digest.mjs` generates them from the data diff.
- Text fields: `ru` required, `en` required for titles/roles/labels, `uz` optional (falls back to ru).
- Design: neutral surfaces, one accent, few controls. Interactions are hidden and discoverable (hover reveals,
  click-to-expand, ⌘K search, `L` language, `T` theme, swipe to close). Do not add buttons to the top bar.
- Local preview: `python3 -m http.server 4173` and open http://localhost:4173.

# AGENTS.md — Anthropic Atlas

Static site + daily data pipeline that monitors Anthropic from public sources.
Production: https://athropic-atlas.vercel.app (Vercel, deploys from `main`).

## Read first
- `RUNBOOK.md` — the daily update procedure (what the morning model does, step by step).
- `docs/METHODOLOGY.md` — sources, data model, modularity, pipeline, quality gates.

## Layout
| Path | What |
|---|---|
| `index.html`, `assets/app.css`, `assets/app.js` | the site (no build step; vanilla JS) |
| `data/` | all content: `atlas.json`, `events.json`, `glossary.json`, `modules.json`, `archive.json`, `digests/` |
| `schema/` | JSON Schemas for every data file |
| `sources/sources.json` | source registry (tiers, trusted press, blocked domains) |
| `sources/wiki-overrides.json` | curated Wikipedia candidates for portraits/links |
| `scripts/` | `collect` (sources → inbox), `today` (worklist), `validate`, `digest`, `enrich` (photos, Wikipedia), `test` |
| `pipeline/` | collector state, inbox, watched-page snapshots, run notes (not deployed) |
| `.github/workflows/` | `collect.yml` (05:40 Tashkent), `publish-daily.yml` (merge daily branch), `validate.yml` (CI) |
| `.claude/agents/` | `atlas-daily` and ten `researcher-*` roles (Haiku) |

## Rules
- Every claim needs a source in `sources[]`; tier 1–2 only (see methodology). Never cite news.google.com.
- Run `node scripts/validate.mjs && node scripts/test.mjs` after any change; CI runs them too.
- Do not hand-edit `data/digests/*`; `scripts/digest.mjs` generates them from the data diff.
- Text fields: `ru` required, `en` required for titles/roles/labels, `uz` optional (falls back to ru).
- Design: neutral surfaces, one accent, few controls. Interactions are hidden and discoverable (hover reveals,
  click-to-expand, ⌘K search, `L` language, `T` theme, swipe to close). Do not add buttons to the top bar.
- Local preview: `python3 -m http.server 4173` and open http://localhost:4173.

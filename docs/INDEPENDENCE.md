# Independence inventory

Anthropic Atlas is meant to keep running if the owner stops paying for any single service. This file lists every
external dependency, what happens if it disappears, and the fallback. Last reviewed: 2026-11-18.

## No model is required

No workflow reads an Anthropic or Claude secret. The only secrets referenced anywhere in `.github/workflows/` are
the optional `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (`collect.yml`); everything else uses the built-in
`github.token`. The daily data (collect, library catalog, portraits, digest, RSS) is produced by plain Node scripts.

The optional 07:07 Tashkent Claude run (see `RUNBOOK.md`) adds hand-checked events with Russian summaries, people and
facts, and Russian library cards. Without it: no new hand-checked events, new library pages show English titles and
descriptions until a card exists, and the digest uses its automatic headline built from new official posts.
Everything already on the site stays. `publish-daily.yml` then simply never triggers (it reacts to `claude/**` branches).

## Dependencies

| Dependency | Used for | If it disappears | Fallback |
|---|---|---|---|
| GitHub (repository, Actions) | source of truth, daily/hourly/CI workflows, issue alerts | no new data and no CI; the deployed site keeps serving the last build | Run the same steps anywhere with Node 22: `node scripts/collect.mjs && node scripts/library.mjs && node scripts/digest.mjs && npm run check`, commit and push to any git host that Vercel (or another static host) can deploy from. Workflows are thin wrappers over these commands. |
| Vercel (Hobby plan) | static hosting, deploy from `main`, security headers (`vercel.json`) | site goes offline or stops updating | The site is plain static files with no build step: serve the repository root from GitHub Pages, Cloudflare Pages, Netlify or any web server. Headers in `vercel.json` (CSP, nosniff) need to be re-created on the new host; `smoke.mjs` takes `--url` for the new address. |
| npm registry (`ajv`, `ajv-formats`, dev only) | JSON Schema validation in `validate.mjs` | `npm ci` fails in CI/locally; the site itself is unaffected (no runtime dependencies) | Versions are pinned in `package-lock.json`; keep a copy of `node_modules` or vendor the two packages. The site and the data scripts other than `validate` need no packages. |
| Playwright (smoke test only) | real-browser check in `collect.yml`, `publish-daily.yml`, `validate.yml`, `health.yml` | smoke step fails; collect keeps only the inbox and holds back site data (by design), health alerts | Pinned in the workflows (`playwright@1.55.0`), not in `package.json`. Skip with a manual review, or point `CHROMIUM_PATH` at any installed Chromium. Not needed at runtime. |
| Google Fonts | web fonts in the page (being removed by the frontend work) | text falls back to system fonts; smoke test already blocks the font hosts and passes | Once removed there is no dependency. Until then the CSS font stack must keep a system fallback. |
| Wikipedia / Wikimedia (REST API, Commons images) | `enrich.mjs`: reference links and portraits for people | no new links or portraits; `enrich` failure is a warning, the workflow continues | Portraits are saved into `assets/people/` and `avatar` points at the local file, so existing pictures never depend on Wikimedia. People without a photo show a monogram. Add links by hand in `data/atlas.json` (`links`). |
| Public Anthropic sources (anthropic.com, claude.com, docs, help center, GitHub `anthropics`, MCP site, Skilljar) | the collector and library catalog | a failing source is reported in the inbox, a library source that shrinks suddenly is ignored and its items are kept (`gone` is never set from a broken fetch) | `library.mjs` keeps the previous catalog; see `docs/METHODOLOGY.md` for source tiers. |
| Telegram Bot API (optional) | morning digest message | no message; nothing else changes | Subscribe to the RSS feed `/data/feed.xml` in any reader. The step is skipped when the secrets are not set. |
| `images.weserv.nl` (optional, `enrich.mjs`) | resize fallback for a person's existing external avatar | that fallback photo is skipped, the monogram is used | Wikipedia lead image is tried first; external avatars are never hot-linked. |

## Checklist after a lapse

1. Open the Actions tab and confirm `collect.yml`, `health.yml` and `validate.yml` are enabled (GitHub pauses
   schedules in repositories with no activity; the collect job re-enables them on every run).
2. Check `pipeline/inbox/latest.json` is from today or yesterday (`npm run today` prints a STALE warning otherwise).
3. Run `npm run check` locally before merging anything by hand.

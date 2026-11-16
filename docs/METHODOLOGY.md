# Methodology — Anthropic Atlas

Anthropic Atlas is a company monitor built only from public sources. This document is the contract between the
data, the daily pipeline, the people who edit it, and the models that update it. If code and this document disagree,
fix one of them in the same change.

## 1. Principles
1. **Every claim has a source.** Each person, product, fact, event and term carries `sources[]` (https only).
   A claim without a source that the editor actually opened is not published.
2. **Primary sources first.** Source tiers (`sources/sources.json`):
   - Tier 1 — primary: anthropic.com, claude.com, platform.claude.com / docs, support.claude.com release notes,
     alignment.anthropic.com, official GitHub, SEC EDGAR.
   - Tier 2 — trusted press (`trustedPress`): Reuters, Bloomberg, FT, WSJ, NYT, CNBC, The Information, TechCrunch,
     The Verge, Axios, AP, etc.
   - Tier 3 — discovery only (Google News feeds). Never the only source of a published claim.
   - Blocked (`blockedDomains`): SEO aggregators and user-generated sites; the validator rejects them.
3. **The report is computed, not written.** What was *added / updated / removed* comes from a diff of the data
   (`scripts/digest.mjs`), so the daily notification can never disagree with the board.
4. **Nothing silently disappears.** People who leave become `former`, products become `legacy`/`retired`.
   Only proven-wrong records move to `data/archive.json`, with a reason.
5. **Freshness is measured.** Every entity has `verifiedAt`. Each entity is re-verified once a week (rolling, 1/7
   per day); the validator warns after 60 days.
6. **Determinism where possible, models where needed.** Fetching, diffing, validation and the digest are plain
   scripts. The model only judges relevance, reads sources and writes short texts.

## 2. Data model (aligned with schema.org)
All data lives in `data/` and is validated by JSON Schemas in `schema/` plus integrity rules in `scripts/validate.mjs`.

| File | Entity | schema.org analogue | Notes |
|---|---|---|---|
| `atlas.json#people` | person / group | `Person` (`worksFor`, `jobTitle`, `sameAs`) | `links.wikipedia/wikidata/official…` = `sameAs`; `status` active/former; `since`/`until` |
| `atlas.json#products` | product family | `Product` / `SoftwareApplication` | `children[]` = individual models/apps (`apiId`, `status`, `released`, `docs`) — drill-down level 2 |
| `atlas.json#facts` | key number | `PropertyValue` | `value`, `note`, `asOf`, `sources` |
| `atlas.json#shareClasses` | governance | `Organization` structure | voting/economic rights per class |
| `atlas.json#edges` | relation | `memberOf` / `parentOrganization` | `gov` = board/trust oversight, `rep` = reporting line |
| `events.json` | dated happening | `Event` / `NewsArticle` | sorted newest first; id = `date-slug` |
| `glossary.json` | term | `DefinedTerm` | auto-linked in every text on the site |
| `digests/*.json` | daily report | `Report` | generated only by `digest.mjs` |
| `archive.json` | removed record | — | full snapshot + reason |

Every entity, whatever its kind, has the same core: `id`, a name, a description in `{ru,en,uz?}` (ru required,
en required for titles), `links`, `sources`, `verifiedAt`. The site therefore opens **any** entity in the same sheet
template (header → description → reference links → attributes → children → relations → events → sources), and
drilling down (product → model → its docs, person → reports → their products) works the same way at every depth.

Identifiers: lowercase kebab-case, stable forever (URLs use them: `/#/person/dario-amodei`).

## 3. Modularity: adding a block or a topic
The page is assembled from `data/modules.json`. Each module = `{ id, renderer, title, lead?, source?, hidden? }`.
- Reorder, hide or rename a section → edit `modules.json` only.
- **New topic with existing shapes** (e.g. "Compute & data centers", "Customers", "Competitors"): create
  `data/topics/<topic>.json` as `{ "items": [ { "id", "name", "description": {ru,en}, "metrics"?, "links"?, "sources", "verifiedAt" } ] }`
  and add `{ "id": "compute", "renderer": "cards", "source": "topics/compute.json#items", "title": {…} }`.
  Items open in the standard sheet. Add a schema in `schema/` and a check in `validate.mjs` when the topic is permanent.
- **New kind of view** → add one function to the renderer map `R` in `assets/app.js` and its name to the
  `renderer` enum in `schema/modules.schema.json`.
- **New source** → add one object to `sources/sources.json` (`sitemap`, `rss`, `dated-headings`, `changelog-md`,
  `page-watch`). A new source is baselined on its first run, so it never floods the inbox.
- **New term** → add to `glossary.json`; it is underlined with a tooltip everywhere it appears.

## 4. Daily pipeline
| Time (Tashkent) | Step | Where | What |
|---|---|---|---|
| 05:40 | Collect | GitHub Actions `collect.yml` | `collect.mjs` fetches all sources, writes only *new* items to `pipeline/inbox/`; `enrich.mjs` adds Wikipedia links and portraits for new people; commit to `main` |
| 07:07 | Update | Scheduled Claude session (lightweight model) | follows `RUNBOOK.md`: triage → events → entity changes → re-verification → notes → validate → digest |
| ~07:20 | Publish | GitHub Actions `publish-daily.yml` | re-validates the `claude/*` branch (only `data/` and `pipeline/` may change) and merges into `main` |
| ~07:21 | Deploy | Vercel | static site redeploys from `main` (pipeline-only commits are skipped) |
| ~07:20 | Notify | Claude app push notification | the digest: headline, company news, added, updated, removed |

Failure behaviour: a failing source is listed in the digest and the run continues; invalid data is never merged
(validation in the session and again in CI); a stale inbox triggers a local collection run.

## 5. Quality gates
`scripts/validate.mjs` (schema + rules), `scripts/test.mjs` (13 negative cases the validator must reject, digest
correctness on a synthetic diff). Both run in the daily session, in `publish-daily.yml`, and on every push/PR
(`validate.yml`).

## 6. Portraits and reference links
`scripts/enrich.mjs` looks up English Wikipedia. A search hit is accepted only if its intro mentions Anthropic;
for people whose article does not, curated candidates live in `sources/wiki-overrides.json` with an `expect`
phrase that must appear. Portraits are copied into `assets/people/` (never hot-linked); without a photo the site
shows a monogram icon. Every person must have at least one reference link (validator warning otherwise).

## 7. Roles of the research agents
`.claude/agents/` defines ten Haiku researchers with fixed scopes (leadership, governance, finance, models, apps,
developer platform, safety, talent, policy, source audit) used for full audits, and `atlas-daily`, the daily updater.
A full audit = run all ten with `docs/research-brief.md`, then an editor applies only findings with a real quote
and a tier 1–2 source.

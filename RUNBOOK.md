# RUNBOOK — daily update (for the morning model)

You update the Anthropic Atlas board once a day. Work **only** inside `data/` and `pipeline/run/`.
Never edit `index.html`, `assets/`, `scripts/`, `schema/` or workflows. Never invent facts: every new or changed
statement needs a source you actually opened. When unsure, leave the data as it is and mention it in the notes.

Time zone: Asia/Tashkent. `DATE` below means today's date there (`node scripts/today.mjs` prints it).

## 1. Prepare (2 commands)
```bash
npm ci --silent
node scripts/today.mjs > /tmp/worklist.md && cat /tmp/worklist.md
```
The worklist shows: pipeline health, **candidates** (new items found by the 05:40 collector), items already on the
board (skip them), and **entities to re-verify today**.
If the inbox is marked STALE, run `NODE_USE_ENV_PROXY=1 node scripts/collect.mjs` once and re-run `today.mjs`
(some sources may fail from the cloud; that is fine, use WebSearch for the gaps).

## 2. Triage every candidate
For each candidate decide one of: **event**, **entity change**, **both**, or **discard**.

Keep only things that happened to *Anthropic the company*: model or product launches and retirements, pricing,
releases, leadership hires/departures, board/trust changes, funding/IPO/financials, legal and regulatory actions,
government contracts, major partnerships and compute deals, official research/safety publications, major incidents.

Discard: opinion and analysis pieces, tutorials, stock-tip articles, rumours without a named source, minor bug-fix
releases, marketing case studies (unless a top-tier customer deal), anything older than 7 days, duplicates.

Tier 3 items (Google News) are **leads only**: open them, then find the primary source (anthropic.com, claude.com,
docs, sec.gov) or a trusted outlet from `sources/sources.json → trustedPress`, and cite that. Never cite news.google.com.

Watched-page diffs (`Page changed: …`) list added `+` and removed `-` lines. Act only if a line shows a real change
(new title, new model id, new price, a person added/removed). Layout noise → discard.

## 3. Write events → `data/events.json`
Insert new events **at the correct position** (array is sorted newest first). Shape (the `//` comments only explain fields; real JSON has no comments):
```json
{
  "id": "2026-11-18-anthropic-prices-ipo",          // DATE-of-event + short english slug, lowercase, hyphens
  "date": "2026-11-18",                              // when it happened (not today if it happened earlier)
  "type": "finance",                                 // model | product | people | governance | finance | policy | research | safety | partnership | legal | infrastructure
  "importance": 3,                                   // 3 company-level, 2 notable, 1 minor
  "title":   { "ru": "…", "en": "…" },               // short headline, both languages required
  "summary": { "ru": "1–2 предложения: что и почему важно.", "en": "…" },
  "entities": ["dario-amodei", "prod-claude-55"],    // optional, only ids that exist in data/atlas.json
  "sources": [ { "title": "Anthropic", "url": "https://www.anthropic.com/news/…" } ],
  "addedAt": "DATE"
}
```
One event per real-world happening. If two sources describe the same thing, add the second as an extra source.
Future plans ("will price on Nov 18") are not events yet; mention them in the summary of today's event.

## 4. Apply entity changes → `data/atlas.json`
| Situation | Do |
|---|---|
| Person leaves | `status: "former"`, `until: "YYYY-MM"`, update `role` to "Former …", put the source first in `sources` |
| New notable person | add a person object (copy an existing one as template: id, name, kind "person", zone, status, role{ru,en,uz}, since, influence 0–100, initials, bio{ru}, sources, verifiedAt). Leave `avatar` and `links` empty: the enrichment job adds the photo and Wikipedia link |
| Title change | update `role` (all three languages if possible, ru+en required) |
| New product / model | add a product (id `prod-…`, cluster models/agentic/workspace/safety, status, released, owners = existing person ids, description{ru,en}, sources, verifiedAt). New model versions go into `children` of the family product with `apiId` |
| Model deprecated / retired | update the child `status` (deprecated/retired) or the product `status` (legacy/retired) |
| Key number changes (IPO price, valuation, revenue…) | update the `facts` entry `value`, `note`, `asOf`, `sources` |

Whenever you touch an entity, set `verifiedAt` to DATE. Never delete people or products: departures become
`former`, products become `legacy`/`retired`. If something must disappear entirely (proved wrong), move the full
object to `data/archive.json` with `removedAt` and `reason`.

## 5. Re-verify today's entities
For each entity in "Re-verify today": open its first source (or the leadership page / models page).
If still correct → set `verifiedAt` to DATE. If not → fix it (step 4). If the source is dead → find a better one.

## 6. Notes for the digest → `pipeline/run/notes.json`
```json
{
  "date": "DATE",
  "headline": { "ru": "Главное за день одной фразой", "en": "…" },
  "summary":  { "ru": "2–3 предложения: самое важное для человека, который следит за компанией.", "en": "…" },
  "reasons":  { "<entity id>": "почему изменено или убрано (по-русски, коротко)" }
}
```
If nothing happened: headline "Без существенных новостей", summary is one plain sentence for a reader (for example "Новых событий нет; цифры IPO и состав руководства перепроверены по первоисточникам"). Never mention pipeline internals (candidates, leads, levels, Google News, "отсеяны"). The site then leads with the latest real event instead of this headline.

## 6b. Library cards (Russian summaries for new public materials)
The 05:40 job keeps `data/library.json` (every public Anthropic page: research, engineering, news, guides, docs…)
up to date by itself. Your only job here is to write short Russian cards for items that have none yet:
```bash
node scripts/library-notes.mjs --todo --limit=40      # TSV: id, section, title, description, url
```
Write `/tmp/cards.json` as `{"<id>": {"t": "Русский заголовок", "s": "1–2 предложения, только факты из описания", "w": ["developers"], "d": "Необязательный практический шаг"}}`
(`w` from: learners, developers, researchers, business, policy, everyone; `d` only for practical guides and docs), then:
```bash
node scripts/library-notes.mjs --add=/tmp/cards.json
```
Never edit `data/library.json` or `data/library-notes.json` directly. If you skip this step, the site shows the
original English description; nothing breaks.

## 7. Check and build (must all pass)
```bash
node scripts/validate.mjs      # fix every ERROR and run again until "OK"
node scripts/digest.mjs        # builds data/digests/DATE.json from the actual diff and prints the Russian digest
node scripts/validate.mjs && node scripts/test.mjs
node scripts/guard.mjs         # fails if records disappeared without going through data/archive.json
```
`digest.mjs` decides what was added/updated/removed by comparing with the last commit, so the report always
matches the data. Do not edit `data/digests/*` by hand.

## 8. Hand back
Return the full text printed by `digest.mjs` (also saved in `pipeline/run/digest.md`). The orchestrating session
commits with a message starting `atlas-daily: DATE`, pushes to its `claude/…` branch, and the
`Publish daily update` workflow re-validates and merges it into `main`, which deploys the site.

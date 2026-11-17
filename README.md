# Anthropic Atlas

A daily-updated monitor of Anthropic built only from public sources: what the company announced, who runs it,
who controls it, what it ships. Every statement links to its source.

**Live:** https://anthropic-atlas.vercel.app

## Runs on its own

Everything that keeps the site current runs on free GitHub Actions and Vercel, with no model and no paid account:

| When (Tashkent) | What | Model? |
|---|---|---|
| 05:40 daily | `collect.yml`: catalog of every public Anthropic page (library), new candidate items, portraits, the daily digest computed from the data diff and new official posts, RSS feed at `/data/feed.xml`, optional Telegram message | no |
| every push | `validate.yml`: schemas, regression tests, mass-deletion guard, real-browser smoke test | no |
| hourly | `health.yml`: smoke test of production; rolls back a data commit only when it is proven to be the cause | no |

The chronicle and the top story also show official anthropic.com posts automatically, so the page stays current even if
nothing else runs. New library items show the English title and description until a Russian card exists.

**Optional layer.** A lightweight Claude run (07:07, `RUNBOOK.md`) adds what needs judgment: verified events with Russian
summaries, people and facts, Russian library cards. If it stops, nothing breaks; the page just has fewer hand-checked events.

**Telegram (optional).** Add repository secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`; the morning digest is then sent there.

- How it works and how to extend it: [docs/METHODOLOGY.md](docs/METHODOLOGY.md). Daily procedure: [RUNBOOK.md](RUNBOOK.md).

```bash
npm ci
node scripts/validate.mjs && node scripts/test.mjs   # quality gates
node scripts/today.mjs                               # today's worklist
python3 -m http.server 4173                          # preview
```

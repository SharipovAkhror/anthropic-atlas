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
npm run check                      # validate + regression tests + mass-deletion guard (the one gate)
npm test                           # only the regression tests (scripts/test.mjs)
npm run smoke                      # real-browser test, serves this checkout on a free port (needs Playwright)
npm run today                      # today's worklist
python3 -m http.server 4173        # preview
```

| `npm run` | What |
|---|---|
| `check` | `validate`, then `test`, then `guard`. CI and the Claude Code edit hook run the same steps. |
| `test` | `scripts/test.mjs`: validator rejections, digest, guard, collector and library parsers, shared helpers. |
| `validate` / `guard` | schema and editorial rules / nothing lost compared with `origin/main`. |
| `smoke` | Chromium on a laptop and a phone; `-- --url=https://anthropic-atlas.vercel.app` tests production. |
| `collect` `library` `digest` `enrich` `today` | the daily steps, each runnable by hand; `collect`, `library` and `digest` take `--dry` or `--print-only`. |
| `serve` | static preview on port 4173 via `npx serve`. |

## Если подписка Claude закончится

Сайт не зависит от подписки Claude. Ни один workflow не использует секрет Anthropic или Claude; единственные
необязательные секреты относятся к Telegram.

**Продолжит работать без изменений**
- `collect.yml`: ежедневно в 05:40 по Ташкенту собирает новые материалы, каталог библиотеки, портреты, дайджест и RSS.
- `health.yml`: ежечасная проверка продакшена, откат сломанного коммита с данными.
- `validate.yml`: проверка схем, тестов и защиты от потери данных на каждом пуше.
- Деплой на Vercel из ветки `main`.
- RSS-лента `/data/feed.xml`.
- Сообщение в Telegram, если заданы секреты `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` (необязательно).

**Остановится**
- Необязательный запуск Claude в 07:07: вручную проверенные события с русскими сводками.
- Русские карточки библиотеки для новых страниц.

Новые страницы библиотеки показывают английские заголовки и описания, пока для них нет русской карточки.
Если проверенных событий нет больше двух дней, главным на странице становится свежий официальный пост Anthropic
(на английском), а «Последнее по темам» и цифры продолжают показывать последнее проверенное с датами, так что
устаревание видно читателю. Запланированная задача Claude при паузе подписки просто приостанавливается и сама
возобновится, когда подписка вернётся; ничего отключать или чинить не нужно.
Всё уже написанное остаётся на сайте. Подробный перечень зависимостей и запасных вариантов: [docs/INDEPENDENCE.md](docs/INDEPENDENCE.md).

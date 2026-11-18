# Testing: who checks what, and when

The testing team has two parts. The automated part runs free on GitHub Actions with no model and no Claude
subscription. The optional part is three Claude tester roles that hunt for what the automated part does not cover yet;
every bug they find becomes an automated check, so the same bug cannot come back.

## Automated (no model, free)

| Layer | Script | What it proves | Runs |
|---|---|---|---|
| Schema and integrity | `scripts/validate.mjs` | every file has the right shape; sources present and not blocked; no dangling references; real calendar dates; no empty text; no duplicate names, terms, API ids; digest index sorted, counts and headline match each digest | every PR, every data commit, `npm run check` |
| Regression | `scripts/test.mjs` | the validator rejects 25 typical mistakes; the digest is computed from the data diff and a re-run changes nothing; guard, collector, library and link-checker logic on fixed inputs | every PR, `npm run check` |
| Nothing lost | `scripts/guard.mjs` | no person, product, fact, event, term, opinion, section or digest disappears without a real archive snapshot; the archive only grows; no file shrinks by more than 20% | every PR, every publish, the edit hook |
| Smoke | `scripts/smoke.mjs` | the site opens on a laptop and a phone with no errors | every PR, every morning before data is committed, hourly against production (auto-revert) |
| Full browser suite | `scripts/e2e.mjs` | about 200 checks, listed below | every PR, nightly against production |
| Source links | `scripts/links.mjs` | every cited page still exists (404, 410 and unknown hosts count; robot refusals and outages do not) | Sundays |
| Workflows | actionlint | the workflow files themselves are valid | every PR |
| Collector streaks | `pipeline/state.json` `fails` | a source unreachable 3 mornings in a row | nightly |

`scripts/e2e.mjs` groups (run some with `--only=phone,routes`; `--url=` tests any deployment; `--shots=DIR` saves screenshots):
- **screens**: 1280, 1366, 1440, 1680, 1920, 2560 and 3440 px: no card cut off, no overlaps, no text spilling out of a card,
  key numbers on one line, no `undefined`/`NaN`/`null` text, big screens actually used.
- **camera**: Ctrl + wheel, keys 0 and 1, drag, zoom buttons, map mode with readable labels.
- **sheets**: every person, product, event, term, fact, opinion, shelf and a sample of the library opens with content in
  RU, EN and UZ; every link inside a sheet resolves; only https links.
- **actions**: Save survives a reload, Copy with source gives claim + source + link, Link copies a working address,
  hold-to-clear and Undo.
- **routes**: deep links, unknown links, Escape and Backspace, breadcrumbs, search with keyboard and Cyrillic, language
  cycle, a Russian keyboard layout (Ctrl+К, Д), Space on a focused button.
- **phone**: iPhone SE, iPhone 13, Pixel 7: tabs, overview, the map button is tappable, pinch in and out, tap to open,
  scroll inside the sheet without closing it, swipe down to close, landscape.
- **tablet**: iPad Mini in both orientations.
- **resilience**: each optional data file failing, cut in half or slow: the page still works; atlas.json missing: a
  plain message instead of a blank page.
- **budget**: code under 300 KB, data under 8 MB, cards on screen fast, every control has a name, images have alt text,
  Tab works, reduced motion works.

Anything failing at night opens (or updates) one GitHub issue labelled `qa`, so the owner gets an email.

## Claude testers (optional)

`.claude/agents/qa-desktop.md`, `qa-phone.md`, `qa-data.md`. Each runs the automated suite for its area first, then
hunts by hand in a real browser or a copy of the repository, edits nothing, and reports confirmed bugs with repro steps
and the check that would have caught them. Run them after a large change: "run qa-desktop, qa-phone and qa-data and fix
what they find". The fix goes in with a new check in `e2e.mjs` or `test.mjs`.

Starter for a manual browser session:
```js
import { playwright, serve, launch, prep } from "./scripts/webtest.mjs";
const pw = playwright(), s = await serve(process.cwd()), b = await launch(pw);
const page = await b.newPage({ viewport: { width: 1440, height: 900 } }); await prep(page);
await page.goto(s.url + "/"); // window.ATLAS exposes data, openEntity, cam, fitAll, goHome
```

## First round (2026-11-18)

Three testers found 26 problems; the ones fixed in the same change, each now guarded by a check:
- Phone: the map button could not be tapped in the overview (the bar covered it); pulling down after scrolling the sheet
  closed it; most of the dimmed strip above the sheet ignored taps; the Undo button was small; notch insets.
- Desktop: Ctrl+K, L and / did nothing on a Russian keyboard layout; Space on a focused button scrolled the board
  instead of pressing it; the IPO price range broke across two lines at 1920 and 3440 px; a resize kept the old zoom;
  an unknown deep link gave no feedback.
- Data and pipeline: the guard allowed 3 silent deletions per set and accepted an empty archive stub; opinions, sections
  and digests were not guarded; a re-run made the digest index counts disagree with the digest and re-sent Telegram;
  a dry collector run moved the page-watch baseline; sitemap and RSS items past the daily cap were marked seen and lost;
  one bad library card sank a whole batch; the validator crashed on a wrong-shaped file and accepted 2026-02-31;
  a blind source (SEC EDGAR, 403 for three days) raised no alarm; the Bash hook missed `git -c … push -f`, `--mirror`
  and `reset --hard HEAD~`.

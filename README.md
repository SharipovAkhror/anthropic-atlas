# Anthropic Atlas

A daily-updated monitor of Anthropic built only from public sources: what the company announced, who runs it,
who controls it, what it ships. Every statement links to its source.

**Live:** https://athropic-atlas.vercel.app

- Every morning (Asia/Tashkent) a collector gathers new items from 19 sources, a lightweight Claude model
  verifies them and updates the board, and a digest (news · added · updated · removed) is sent as a notification.
- How it works and how to extend it: [docs/METHODOLOGY.md](docs/METHODOLOGY.md). Daily procedure: [RUNBOOK.md](RUNBOOK.md).

```bash
npm ci
node scripts/validate.mjs && node scripts/test.mjs   # quality gates
node scripts/today.mjs                               # today's worklist
python3 -m http.server 4173                          # preview
```

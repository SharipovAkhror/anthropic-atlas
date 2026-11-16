# Research brief: Anthropic Atlas fact-check (use today's date)

The file `data/atlas.json` (plus `data/events.json`) holds the board's current dataset about the company Anthropic:
`people[]`, `products[]`, `facts[]`, `edges[]` (see schema/atlas.schema.json).

## Rules
- Use WebSearch and WebFetch to verify against PUBLIC sources. Priority of sources: (1) primary: anthropic.com, claude.com, platform.claude.com / docs.claude.com, sec.gov EDGAR, official GitHub; (2) major press: Reuters, Bloomberg, FT, WSJ, NYT, CNBC, The Information, TechCrunch, The Verge, Axios; (3) anything else only as last resort and mark confidence "low".
- Never invent. Every correction/addition/event MUST have a real URL you actually opened or saw in search results, plus a short verbatim quote (<=25 words) supporting it.
- If you cannot confirm something either way, say so in `unverified` instead of guessing.
- Dates as YYYY-MM-DD (or YYYY-MM when day unknown).
- Stay inside your role's scope. Spend at most ~25 tool calls.
- Write your result as ONE JSON file to the output path given in your task (use the Write tool), exactly in this shape:

```json
{
  "role": "<your role id>",
  "checkedAt": "YYYY-MM-DD",
  "confirmed": [ {"entity":"people|products|facts","id":"<id or fact name>","sourceUrl":"...","quote":"..."} ],
  "corrections": [ {"entity":"people|products|facts","id":"...","field":"...","current":"...","proposed":"...","sourceUrl":"...","quote":"...","confidence":"high|medium|low"} ],
  "additions": [ {"kind":"person|product|fact","proposed": { "name":"...", "role_en":"...", "date":"...", "details":"..." },"sourceUrl":"...","quote":"...","confidence":"high|medium|low"} ],
  "removals": [ {"entity":"people|products","id":"...","reason":"...","sourceUrl":"...","quote":"..."} ],
  "events": [ {"date":"YYYY-MM-DD","type":"model|product|people|governance|finance|policy|research|partnership|legal|safety|infrastructure","title_en":"...","title_ru":"...","summary_en":"1-2 sentences","summary_ru":"1-2 предложения","sourceUrl":"...","importance":1} ],
  "sourceIssues": [ {"id":"...","url":"...","problem":"dead|weak|does-not-support-claim","replacementUrl":"..."} ],
  "unverified": [ "..." ],
  "notes": "short free text"
}
```
`importance`: 3 = major company-level news, 2 = notable, 1 = minor. Events must be from 2026-08-01 or later.
Your final reply should be just: the output path and counts per section.

#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash). Blocks the few commands that can destroy history or data in one step.
let input = ""; for await (const c of process.stdin) input += c;
let cmd = ""; try { cmd = JSON.parse(input).tool_input?.command || ""; } catch {}
const rules = [
  [/git\s+push\b[^|;&]*\s(-f|--force)(\s|$)/, "force-push rewrites published history"],
  [/git\s+push\b[^|;&]*\s(origin\s+)?(HEAD:)?main(\s|$)/, "pushing straight to main skips the publish checks; push a claude/* branch"],
  [/rm\s+-[a-z]*r[a-z]*\s+[^|;&]*\b(data|schema|scripts|\.github)\b/, "deleting project folders"],
  [/git\s+reset\s+--hard\s+origin/, "discarding work without review"]
];
for (const [re, why] of rules) if (re.test(cmd)) { process.stderr.write(`Blocked by .claude/settings.json hook: ${why}.\nCommand: ${cmd}`); process.exit(2); }

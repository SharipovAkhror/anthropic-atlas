#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash). Blocks the few commands that can destroy history or data in one step.
let input = ""; for await (const c of process.stdin) input += c;
let cmd = ""; try { cmd = JSON.parse(input).tool_input?.command || ""; } catch {}
// Advisory, not a security boundary: the server-side branch rules on main are the real lock.
const rules = [
  [/git\s+(-[cC]\s+\S+\s+)*push\b[^|;&]*(\s(-f|--force|--force-with-lease)\b|\s\+\S)/, "force-push rewrites published history"],
  [/git\s+(-[cC]\s+\S+\s+)*push\b[^|;&]*\s(\S+:)?(refs\/heads\/)?main(\s|$)/, "pushing straight to main skips the publish checks; push a claude/* branch"],
  [/(^|[\s;&|])(rm\s+(-[a-z]*r[a-z]*|--recursive)|git\s+rm\s+-[a-z]*r[a-z]*)(\s+-\S+)*[^|;&]*?(^|\s|["'])(\.\/)?(data|schema|scripts|\.github)\/?(?=\s|$|["'])/, "deleting project folders"],
  [/find\s+(\.\/)?(data|schema|scripts)\b[^|;&]*-delete/, "deleting project folders"],
  [/git\s+clean\s+-[a-z]*f[a-z]*d|git\s+clean\s+-[a-z]*d[a-z]*f/, "git clean removes untracked work"],
  [/git\s+(-[cC]\s+\S+\s+)*push\b[^|;&]*\s--mirror\b/, "a mirror push can delete remote branches"],
  [/git\s+reset\s+--hard\s+(origin|HEAD[~^]|@[~^])/, "discarding work without review"]
];
for (const [re, why] of rules) if (re.test(cmd)) { process.stderr.write(`Blocked by .claude/settings.json hook: ${why}.\nCommand: ${cmd}`); process.exit(2); }

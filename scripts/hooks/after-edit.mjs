#!/usr/bin/env node
// Claude Code PostToolUse hook (Edit|Write). After any edit to data/ or schema/, run the validator and the
// mass-deletion guard; on failure exit 2 so the error goes straight back to the model that made the edit.
// Rules that must not have exceptions live here and in CI, not only in written instructions.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let input = ""; for await (const c of process.stdin) input += c;
let file = ""; try { file = JSON.parse(input).tool_input?.file_path || ""; } catch {}
if (!/\/(data|schema)\/[^/]+.*\.json$/.test(file)) process.exit(0);
for (const [script, args] of [["validate.mjs", ["--quiet"]], ["guard.mjs", ["--base=HEAD"]]]) {
  try { execFileSync(process.execPath, [join(ROOT, "scripts", script), ...args], { cwd: ROOT, stdio: "pipe", encoding: "utf8" }); }
  catch (e) { process.stderr.write(`${script} failed after editing ${file}:\n${(e.stdout || "") + (e.stderr || "")}`.slice(0, 4000)); process.exit(2); }
}

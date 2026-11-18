// Small helpers shared by the pipeline scripts. Pure Node, no dependencies.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

/** Repository root. Scripts that support sandboxes honour ATLAS_ROOT (tests run them on a copy of the data). */
export const repoRoot = (useEnv = false) => (useEnv && process.env.ATLAS_ROOT) || join(dirname(fileURLToPath(import.meta.url)), "..");

/** `--key=value` and bare `--flag` arguments as an object: ["--date=2026-01-01", "--dry"] -> { date, dry: true }. */
export const parseArgs = argv => Object.fromEntries(argv.map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));

/** The board's day is Tashkent's day. Returns YYYY-MM-DD. */
export const tashkentDate = (now = new Date()) => now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });

/** A millisecond timestamp as a UTC YYYY-MM-DD string (used for "N days ago" cut-offs). */
export const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

/** Reads and parses a JSON file. */
export const readJson = path => JSON.parse(readFileSync(path, "utf8"));

/** Like readJson, but a missing file returns the fallback (a broken file still throws). */
export const readJsonOr = (path, fallback) => (existsSync(path) ? readJson(path) : fallback);

/** True when the module is the script being run, not imported (so scripts can export pure functions for tests). */
export const isMain = metaUrl => !!process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;

export const sha = (s, n = 10) => createHash("sha1").update(s).digest("hex").slice(0, n);

/** Decodes the XML/HTML entities and CDATA that appear in feeds, sitemaps and page metadata. Never throws on bad numeric entities. */
export const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);|&#x([0-9a-f]+);/gi, (_, d, h) => { const n = d ? +d : parseInt(h, 16); return n > 0 && n <= 0x10FFFF && (n < 0xD800 || n > 0xDFFF) ? String.fromCodePoint(n) : ""; })
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

/** Canonical form of a page URL used as an identity: https, no ".md" suffix, no trailing slash. */
export const normalizeUrl = u => u.replace(/\.md$/, "").replace(/\/$/, "").replace(/^http:/, "https:");

/** GET with retries and a growing pause. Throws an Error naming the URL after the last failure. */
export async function fetchText(url, { userAgent, tries = 3, backoffMs = 1200, timeoutMs = 25000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": userAgent, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { last = e; await new Promise(r => setTimeout(r, backoffMs * (i + 1))); }
  }
  throw new Error(`${url}: ${last?.message}`);
}

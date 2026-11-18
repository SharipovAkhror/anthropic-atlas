// Shared helpers for the browser tests (smoke.mjs, e2e.mjs): a tiny static server that sends the production
// Content-Security-Policy, Playwright loading, and a page wrapper that records page errors.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { join, extname, normalize } from "node:path";

const require = createRequire(import.meta.url);
export function playwright() {
  try { return require("playwright"); } catch { return require(join(execSync("npm root -g").toString().trim(), "playwright")); }
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

// Serves `root` on a free port. Sends the CSP from vercel.json, so a page the CSP would break fails here first.
export async function serve(root) {
  let csp = "";
  try { csp = JSON.parse(await readFile(join(root, "vercel.json"), "utf8")).headers.flatMap(h => h.headers).find(h => h.key === "Content-Security-Policy")?.value || ""; } catch {}
  const srv = createServer(async (req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try { const b = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", ...(csp ? { "content-security-policy": csp } : {}) }).end(b); }
    catch { res.writeHead(404).end("not found"); }
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  return { srv, url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise(r => srv.close(r)) };
}

export const launch = pw => pw.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// Collects page errors and console errors; skips the intro and the first-visit hint so tests see the plain page.
export async function prep(page, { intro = false } = {}) {
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|favicon|ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (!intro) await page.addInitScript(() => { try { sessionStorage.setItem("atlas.intro", "1"); localStorage.setItem("atlas.hint", "1"); } catch {} });
  return errs;
}

export function reporter() {
  let failed = 0, passed = 0;
  const ok = (cond, name) => { console.log(`${cond ? "pass" : "FAIL"}  ${name}`); cond ? passed++ : failed++; return cond; };
  return { ok, get failed() { return failed; }, get passed() { return passed; } };
}

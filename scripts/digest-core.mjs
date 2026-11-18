// Pure logic of the daily digest, separated from digest.mjs (which does the file and git work) so tests can import it.
export const ru = o => (typeof o === "string" ? o : o?.ru || o?.en || "");
export const hasRu = o => !!(o && typeof o === "object" && String(o.ru || "").trim());
/** Russian plural: plural(2, "публикация", "публикации", "публикаций") -> "2 публикации". */
export const plural = (n, one, few, many) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many}`;

const IGNORED = new Set(["verifiedAt", "avatar", "avatarCredit", "links", "label"]); // enrichment and re-verification are not news
/** Compares two lists of records by id. `reasons` maps an id to the human note for a removal or change. */
export function diff(kind, before = [], after = [], label, reasons = {}) {
  const B = new Map(before.map(x => [x.id, x])), A = new Map(after.map(x => [x.id, x]));
  const added = [], updated = [], removed = [], reverified = [];
  for (const [id, a] of A) {
    const b = B.get(id);
    if (!b) { added.push({ kind, id, label: label(a) }); continue; }
    const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !IGNORED.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    const retiredNow = a.status && a.status !== b.status && (["former", "retired"].includes(a.status) || (b.status === "active" && a.status === "legacy"));
    if (retiredNow) { removed.push({ kind, id, label: label(a), reason: reasons[id] || `status → ${a.status}` }); continue; }
    if (fields.length) updated.push({ kind, id, label: label(a), fields, ...(reasons[id] ? { reason: reasons[id] } : {}) });
    else if (a.verifiedAt !== b.verifiedAt) reverified.push(id);
  }
  for (const [id, b] of B) if (!A.has(id)) removed.push({ kind, id, label: label(b), reason: reasons[id] || "removed" });
  return { added, updated, removed, reverified };
}


/** RSS 2.0 feed of the daily digests. Quiet days are not items. `readDigest(date)` returns the digest JSON or null. */
export function feedXml(idx, readDigest, SITE, now = new Date()) {
  const x = s => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "").replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  const busy = d => Object.values(d.counts || {}).some(n => n > 0);
  const items = idx.digests.filter(busy).slice(0, 30).map(d => {
    const dj = readDigest(d.date) || {};
    const when = dj.generatedAt && !isNaN(new Date(dj.generatedAt)) ? new Date(dj.generatedAt) : new Date(d.date + "T00:40:00Z");
    return `<item><title>${x(d.date)} · ${x(ru(d.headline))}</title><link>${SITE}/</link><guid isPermaLink="false">atlas-digest-${x(d.date)}</guid><pubDate>${when.toUTCString()}</pubDate><description>${x(ru(dj.summary))}</description></item>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Anthropic Atlas</title><link>${SITE}/</link><atom:link href="${SITE}/data/feed.xml" rel="self" type="application/rss+xml"/><description>Ежедневная сводка об Anthropic по открытым источникам</description><language>ru</language><lastBuildDate>${now.toUTCString()}</lastBuildDate>\n${items}\n</channel></rss>\n`;
}

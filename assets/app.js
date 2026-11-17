/* Anthropic Atlas — renderer. Data lives in /data/*.json (see docs/METHODOLOGY.md). No build step.
   The page is a spatial board: every module from data/modules.json renders one or more "islands".
   Desktop/tablet: islands are packed into columns on a pannable, zoomable canvas.
   Phone: the same islands become swipeable cards; pinch in (or tap the active tab) for the map of all islands.
   Every entity, at any depth, opens in the same sheet template. */
(() => {
  "use strict";
  if (!Array.prototype.at) Object.defineProperty(Array.prototype, "at", { value(i) { i = Math.trunc(i) || 0; return this[i < 0 ? this.length + i : i]; } });

  // ---------------------------------------------------------------- i18n
  const UI = {
    ru: { updated: "Обновлено", today: "сегодня", yesterday: "вчера", at: "в", news: "новости", added: "добавлено", updatedN: "изменено", libN: "в библиотеке", removed: "убрано", find: "Поиск", search: "Люди, продукты, события, термины", nothing: "Ничего не найдено", former: "Бывшие", trust: "Траст LTBT", board: "Совет директоров", votes: "Голоса акционеров", status: "Статус", since: "В компании с", until: "До", zone: "Направление", released: "Выпуск", metrics: "Ключевое", owners: "Ответственные", children: "Состав", related: "Связи", events: "События", sources: "Источники", verified: "Проверено", wikipedia: "Википедия", official: "Официально", docs: "Документация", wikidata: "Wikidata", github: "GitHub", site: "Сайт", linkedin: "LinkedIn", x: "X", reports: "Подчиняется", manages: "Руководит", oversees: "Под надзором", oversightBy: "Надзор: совет или траст", products: "Продукты", active: "работает", preview: "превью", legacy: "предыдущее", retired: "выведен", deprecated: "устарел", formerS: "бывший сотрудник", activeP: "в компании", copied: "Ссылка скопирована", asOf: "На дату", digestFor: "Сводка за", aliases: "Также", seeAlso: "Где встречается", newBadge: "новое", earlier: "Ранее", showAll: "Показать все", hint: "Перетаскивайте · Ctrl + колесо — масштаб", hintT: "Двигайте пальцем · щипок — масштаб", noDigest: "Сводки пока нет", footer: "Открытые источники, обновление каждое утро", method: "Методология", repo: "GitHub", types: { model: "Модели", product: "Продукты", people: "Люди", governance: "Управление", finance: "Финансы", policy: "Политика", research: "Исследования", safety: "Безопасность", partnership: "Партнёрства", legal: "Право", infrastructure: "Платформа" } },
    en: { updated: "Updated", today: "today", yesterday: "yesterday", at: "at", news: "news", added: "added", updatedN: "updated", libN: "in the library", removed: "removed", find: "Search", search: "People, products, events, terms", nothing: "Nothing found", former: "Former", trust: "Long-Term Benefit Trust", board: "Board of directors", votes: "Shareholder votes", status: "Status", since: "Since", until: "Until", zone: "Area", released: "Released", metrics: "Key figure", owners: "Owners", children: "Includes", related: "Connections", events: "Events", sources: "Sources", verified: "Verified", wikipedia: "Wikipedia", official: "Official", docs: "Docs", wikidata: "Wikidata", github: "GitHub", site: "Website", linkedin: "LinkedIn", x: "X", reports: "Reports to", manages: "Manages", oversees: "Oversight of", oversightBy: "Oversight: board or trust", products: "Products", active: "active", preview: "preview", legacy: "previous", retired: "retired", deprecated: "deprecated", formerS: "former", activeP: "current", copied: "Link copied", asOf: "As of", digestFor: "Digest for", aliases: "Also", seeAlso: "Mentioned in", newBadge: "new", earlier: "Earlier", showAll: "Show all", hint: "Drag to move · Ctrl + wheel to zoom", hintT: "Drag with a finger · pinch to zoom", noDigest: "No digest yet", footer: "Public sources, refreshed every morning", method: "Methodology", repo: "GitHub", types: { model: "Models", product: "Products", people: "People", governance: "Governance", finance: "Finance", policy: "Policy", research: "Research", safety: "Safety", partnership: "Partnerships", legal: "Legal", infrastructure: "Platform" } },
    uz: { updated: "Yangilandi", today: "bugun", yesterday: "kecha", at: "soat", news: "yangilik", added: "qo'shildi", updatedN: "o'zgardi", libN: "kutubxonada", removed: "olib tashlandi", find: "Qidiruv", search: "Odamlar, mahsulotlar, voqealar, atamalar", nothing: "Hech narsa topilmadi", former: "Sobiq", trust: "LTBT trasti", board: "Direktorlar kengashi", votes: "Aksiyadorlar ovozi", status: "Holat", since: "Kompaniyada", until: "Gacha", zone: "Yo'nalish", released: "Chiqarilgan", metrics: "Asosiy", owners: "Mas'ullar", children: "Tarkib", related: "Aloqalar", events: "Voqealar", sources: "Manbalar", verified: "Tekshirilgan", wikipedia: "Vikipediya", official: "Rasmiy", docs: "Hujjatlar", wikidata: "Wikidata", github: "GitHub", site: "Sayt", linkedin: "LinkedIn", x: "X", reports: "Bo'ysunadi", manages: "Boshqaradi", oversees: "Nazorat qiladi", oversightBy: "Nazorat: kengash yoki trast", products: "Mahsulotlar", active: "faol", preview: "sinov", legacy: "oldingi", retired: "to'xtatilgan", deprecated: "eskirgan", formerS: "sobiq", activeP: "kompaniyada", copied: "Havola nusxalandi", asOf: "Sana", digestFor: "Xulosa", aliases: "Shuningdek", seeAlso: "Qayerda uchraydi", newBadge: "yangi", earlier: "Avvalroq", showAll: "Hammasini ko'rsatish", hint: "Suring · Ctrl + g‘ildirak — masshtab", hintT: "Barmoq bilan suring · chimdish — masshtab", noDigest: "Xulosa hali yo'q", footer: "Ochiq manbalar, har kuni ertalab", method: "Metodologiya", repo: "GitHub", types: { model: "Modellar", product: "Mahsulotlar", people: "Odamlar", governance: "Boshqaruv", finance: "Moliya", policy: "Siyosat", research: "Tadqiqot", safety: "Xavfsizlik", partnership: "Hamkorlik", legal: "Huquq", infrastructure: "Platforma" } }
  };
  const LANGS = ["ru", "en", "uz"];
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const S = { lang: LANGS.includes(store.get("atlas.lang")) ? store.get("atlas.lang") : "ru", stack: [], digest: null, allEvents: false };
  const t = k => UI[S.lang][k] ?? UI.ru[k] ?? k;
  const tx = o => (o == null ? "" : typeof o === "string" ? o : o[S.lang] || o.ru || o.en || "");

  // ---------------------------------------------------------------- helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const locale = () => ({ ru: "ru-RU", en: "en-US", uz: "uz-Latn-UZ" }[S.lang]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const phone = () => matchMedia("(max-width: 760px)").matches;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const UZM = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"], UZW = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
  function uzDate(dt, o) {
    const m = o.month === "short" ? UZM[dt.getUTCMonth()].slice(0, 3) : UZM[dt.getUTCMonth()];
    let r = o.day ? `${dt.getUTCDate()}-${m}` : m;
    if (o.year) r = `${dt.getUTCFullYear()}-yil ${r}`;
    if (o.weekday) r = `${UZW[dt.getUTCDay()]}, ${r}`;
    return r;
  }
  function fmtDate(d, opts = { day: "numeric", month: "long", year: "numeric" }) {
    if (!d) return "";
    if (S.lang === "uz" && /^\d{4}-\d{2}(-\d{2})?$/.test(d)) return uzDate(new Date((d.length === 7 ? d + "-01" : d) + "T12:00:00Z"), d.length === 7 ? { month: "long", year: "numeric" } : opts);
    if (/^\d{4}$/.test(d)) return d;
    if (/^\d{4}-\d{2}$/.test(d)) return new Date(d + "-01T12:00:00Z").toLocaleDateString(locale(), { month: "long", year: "numeric" });
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + "T12:00:00Z").toLocaleDateString(locale(), opts);
    return d;
  }
  const initials = p => esc(p.initials || p.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase());
  function avatar(p, cls = "") {
    const img = p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" decoding="async" draggable="false">` : "";
    return `<span class="av ${cls}">${initials(p)}${img}</span>`;
  }
  const safeUrl = u => (/^https:\/\//i.test(String(u || "")) ? String(u) : "#");
  const glyph = name => esc((name.replace(/^Claude\s+/, "").replace(/[^\p{L}\p{N}]/gu, "") || "··").slice(0, 2));
  const icon = (p, cls = "") => (p.kind === "group" ? `<span class="av ${cls}">${initials(p)}</span>` : "");
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 1600); }

  // ---------------------------------------------------------------- data
  let D;
  const IDX = new Map(); // "kind:id" -> entity
  async function getJSON(path) { const r = await fetch(path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
  const normDigest = x => (x && x.date ? { news: [], added: [], updated: [], removed: [], library: [], ...x } : null);
  async function load() {
    const [atlas, events, glossary, modules, digests] = await Promise.all(["/data/atlas.json", "/data/events.json", "/data/glossary.json", "/data/modules.json", "/data/digests/index.json"].map(p => getJSON(p).catch(() => null)));
    if (!atlas) throw new Error("atlas.json");
    D = { atlas, events: (events?.events || []).filter(e => e && e.id && /^\d{4}-\d{2}/.test(e.date || "") && e.title), terms: glossary?.terms || [], modules: modules?.modules || [], digests: digests?.digests || [] };
    for (const p of atlas.people) IDX.set(`person:${p.id}`, { ...p, kind: p.kind === "group" ? "group" : "person", isPerson: true });
    for (const p of atlas.products) IDX.set(`product:${p.id}`, { kind: "product", ...p });
    for (const e of D.events) IDX.set(`event:${e.id}`, { kind: "event", ...e });
    for (const g of D.terms) IDX.set(`term:${g.id}`, { kind: "term", ...g });
    for (const f of atlas.facts) IDX.set(`fact:${f.id}`, { kind: "fact", ...f });
    if (!D.modules.length) throw new Error("modules.json");
    if (D.digests[0]) S.digest = S.latest = normDigest(await getJSON(`/data/digests/${D.digests[0].date}.json`).catch(() => null));
  }
  const ref = x => (x.isPerson ? "person" : x.kind);
  const byId = id => IDX.get(`person:${id}`) || IDX.get(`product:${id}`) || IDX.get(`event:${id}`) || IDX.get(`term:${id}`) || IDX.get(`fact:${id}`);
  const zoneLabel = id => tx(D.atlas.zones.find(z => z.id === id)?.label);
  const clusterLabel = id => tx(D.atlas.clusters.find(z => z.id === id)?.label);
  const picOf = x => (x.isPerson ? (x.kind === "group" ? icon(x) : avatar(x)) : icon({ name: x.name || x.term || tx(x.title) || "·" }));

  // ---------------------------------------------------------------- glossary auto-linking
  let glossRe = null; const glossMap = new Map();
  function buildGloss() {
    const words = [];
    for (const g of D.terms) for (const w of [g.term, ...(g.aliases || [])]) if (w.length > 1) { words.push(w); glossMap.set(w.toLowerCase(), g.id); }
    if (!words.length) return;
    words.sort((a, b) => b.length - a.length);
    const escRe = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
    glossRe = new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escRe).join("|")})(?=$|[^\\p{L}\\p{N}])`, "giu");
  }
  function gloss(text) {
    if (!glossRe) return esc(text);
    const used = new Set();
    return esc(text).replace(glossRe, (m, pre, w) => {
      const id = glossMap.get(w.toLowerCase());
      if (!id || used.has(id)) return m;
      used.add(id);
      return `${pre}<abbr class="g" data-term="${id}">${w}</abbr>`;
    });
  }

  // ---------------------------------------------------------------- islands
  const board = () => $("#board");
  function island(id, title, { count = "", lead = "", cls = "", far = "" } = {}, body = "") {
    const slot = document.createElement("div");
    slot.className = "slot"; slot.dataset.island = id; slot.dataset.title = title;
    slot.innerHTML = `<section class="island ${cls}" id="i-${esc(id)}" aria-label="${esc(title)}" data-title="${esc(title)}"><header class="ih"><h2>${esc(title)}</h2><span class="ic num">${esc(count)}</span></header>${lead ? `<p class="lead-txt">${gloss(lead)}</p>` : ""}<div class="ib">${body}</div><div class="flabel" aria-hidden="true"><b>${esc(title)}</b>${count ? `<span class="num">${esc(count)}</span>` : ""}</div></section>`;
    board().appendChild(slot);
    return slot.firstElementChild;
  }
  const row = (p, side) => `<button class="row ${p.status === "former" ? "former" : ""}" data-open="person:${p.id}">${p.kind === "group" ? icon(p) : avatar(p)}<span class="who"><span class="nm">${esc(p.name)}</span><span class="rl">${esc(tx(p.role))}</span></span>${side !== undefined ? `<span class="side num">${esc(side)}</span>` : ""}</button>`;
  const collapsible = (label, inner) => `<button class="more" aria-expanded="false">${esc(label)}</button><div class="collapse"><div>${inner}</div></div>`;

  const R = {};
  function leadStory() {
    const dg = S.digest, upto = dg?.date || "9999";
    if (dg && dg.news.length) return { k: `${t("digestFor")} ${fmtDate(dg.date)}`, h: tx(dg.headline), s: tx(dg.summary), ref: dg.news.length === 1 && IDX.has(`event:${dg.news[0]}`) ? `event:${dg.news[0]}` : "" };
    const evs = D.events.filter(e => e.date <= upto).sort((a, b) => b.date.localeCompare(a.date) || (b.importance || 0) - (a.importance || 0));
    if (!evs.length) return { k: "", h: dg ? tx(dg.headline) : M("tag"), s: dg ? tx(dg.summary) : "" };
    const e = evs[0];
    const auto = AN().filter(x => x.date > e.date && x.date <= upto && (S.lang === "en" || LIB.notes[x.id]))[0];
    const pick = auto ? { date: auto.date, h: libT(auto.item), s: libS(auto.item), ref: `lib:${auto.id}` } : { date: e.date, h: tx(e.title), s: tx(e.summary), ref: `event:${e.id}` };
    const gap = Math.round((new Date(upto === "9999" ? Date.now() : upto + "T12:00:00Z") - new Date(pick.date + "T12:00:00Z")) / 864e5);
    const quiet = !!dg && !(dg.library || []).length && gap >= 1;
    return { k: `${M("latest")} · ${fmtDate(pick.date, { day: "numeric", month: "long" })}`, h: pick.h, s: pick.s, ref: pick.ref, quiet, gap };
  }

  R.digest = m => {
    const dg = S.digest;
    if (!dg) { island(m.id, tx(m.title), {}, `<p class="lead-txt">${esc(t("noDigest"))}</p>`); return; }
    const newsEv = dg.news.map(id => IDX.get(`event:${id}`)).filter(Boolean);
    const groups = [
      ["news", newsEv.map(e => ({ sign: "", text: tx(e.title), ref: `event:${e.id}` }))],
      ["added", dg.added.map(a => ({ sign: "+", text: a.label, ref: `${a.kind}:${a.id}` }))],
      ["updatedN", dg.updated.map(a => ({ sign: "", text: a.label, why: a.reason || (a.fields || []).join(", "), ref: `${a.kind}:${a.id}` }))],
      ["removed", dg.removed.map(a => ({ sign: "−", text: a.label, why: a.reason, ref: `${a.kind}:${a.id}` }))],
      ["libN", LIB ? (dg.library || []).map(id => IDX.get(`lib:${id}`)).filter(Boolean).map(i => ({ sign: "", text: libT(i), why: secName(i.section), ref: `lib:${i.id}` })) : []]
    ];
    const past = D.digests.slice(0, 7), lead = leadStory();
    if (!phone() && !groups.some(g => g[1].length)) return; // desktop: the hero already says it; an empty card is noise
    const el = island(m.id, tx(m.title), { cls: "today notitle", far: `<div class="far-k">${esc(fmtDate(dg.date))}</div><div class="far-h">${esc(tx(dg.headline))}</div>` }, `
      <div class="date">${esc(lead.k)}</div>
      <h1>${lead.ref ? `<a href="#" data-open="${esc(lead.ref)}">${esc(lead.h)}</a>` : esc(lead.h)}</h1>
      <p class="summary">${gloss(lead.s)}</p>${lead.quiet ? `<p class="quiet">${esc(lead.gap > 1 ? (MAST[S.lang].daysAgo || MAST.ru.daysAgo)(lead.gap) : M("quiet"))}</p>` : ""}
      ${phone() ? `<div class="mstats">${D.atlas.facts.slice(0, 4).map(f => `<button data-open="fact:${f.id}"><b class="num">${esc(tx(f.value))}</b><span>${esc(tx(f.label))}</span></button>`).join("")}</div><p class="mtag">${esc(M("tag"))}</p>` : ""}
      <div class="counts">${groups.filter(g => g[1].length).map(([k, items]) => `<button data-g="${k}" aria-expanded="false"><b class="num">${items.length}</b> ${esc(t(k))}</button>`).join("")}</div>
      <div class="collapse dg"><div><ul class="dl"></ul></div></div>
      ${past.length > 1 ? `<div class="past"><span>${esc(M("digests"))}:</span>${past.map(h => `<button data-d="${h.date}" class="${h.date === dg.date ? "on" : ""}">${esc(fmtDate(h.date, { day: "numeric", month: "short" }))}</button>`).join("")}</div>` : ""}`);
    const panel = $(".dg", el), list = $(".dl", el);
    $$(".counts button", el).forEach(b => b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") === "true";
      $$(".counts button", el).forEach(x => x.setAttribute("aria-expanded", "false"));
      if (open) { panel.classList.remove("open"); relayoutSoon(); return; }
      b.setAttribute("aria-expanded", "true");
      list.innerHTML = groups.find(g => g[0] === b.dataset.g)[1].map(i => `<li><span class="sign">${i.sign}</span><span><a href="#" data-open="${esc(i.ref)}">${esc(i.text)}</a>${i.why ? ` <span class="why">— ${esc(i.why)}</span>` : ""}</span></li>`).join("");
      panel.classList.add("open"); relayoutSoon();
    }));

  };

  R.facts = m => {
    island(m.id, tx(m.title), { far: D.atlas.facts.slice(0, 3).map(f => `<div class="far-v"><b class="num">${esc(f.value)}</b><span>${esc(tx(f.label))}</span></div>`).join("") }, `<div class="facts">${D.atlas.facts.map(f => `<button class="fact" data-open="fact:${f.id}"><span class="k">${esc(tx(f.label))}</span><span class="v num">${esc(f.value)}</span></button>`).join("")}</div>`);
  };

  // Official posts from anthropic.com/news that no curated event covers yet (by URL), newer than the curated
  // chronicle minus a few days: the chronicle stays current even on days when no one curates it.
  const normUrl = u => String(u || "").toLowerCase().replace(/^http:/, "https:").replace(/\/\/www\./, "//").replace(/[#?].*$/, "").replace(/\/+$/, "");
  const words = s => new Set(String(s || "").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
  let AN_CACHE = null;
  const AN = () => (AN_CACHE ??= autoNews());
  function autoNews() {
    if (!LIB) return [];
    const covered = new Set(D.events.flatMap(e => (e.sources || []).map(s => normUrl(s.url))));
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const near = (a, b) => Math.abs(new Date(a) - new Date(b)) <= 864e5 * 1.5;
    return LIB.items.filter(i => i.section === "news" && /^\d{4}-\d{2}-\d{2}$/.test(i.date || "") && i.date >= since && /\/news\/[^/]*-[^/]*$/.test(normUrl(i.url)) && !covered.has(normUrl(i.url)))
      .filter(i => { const w = words(i.title); return !D.events.some(e => near(e.date, i.date) && w.size && [...words(e.title.en)].filter(x => w.has(x)).length / w.size >= .5); })
      .map(i => ({ auto: true, id: i.id, date: i.date, importance: 1, item: i }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  R.timeline = m => {
    const all = [...D.events, ...AN()].sort((a, b) => b.date.localeCompare(a.date) || (b.importance || 0) - (a.importance || 0) || (a.auto ? 1 : 0) - (b.auto ? 1 : 0));
    const evs = S.allEvents ? all : all.slice(0, 16);
    const days = [];
    for (const e of evs) { const last = days.at(-1); if (last && last.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] }); }
    const thisYear = String(new Date().getFullYear());
    const el = island(m.id, tx(m.title), { count: String(all.length), lead: tx(m.lead), far: D.events.slice(0, 6).map(e => `<div class="far-l">${esc(tx(e.title))}</div>`).join("") }, days.map(d => `<div class="day-h num">${esc(fmtDate(d.date, { day: "numeric", month: "long", year: d.date.slice(0, 4) === thisYear ? undefined : "numeric" }))}</div>${d.items.map(e => e.auto ? `
      <button class="ev" data-open="lib:${e.id}" data-imp="2"><span class="t">${esc(libT(e.item))}</span><span class="m">${esc(M("official"))}</span></button>` : `
      <button class="ev" data-open="event:${e.id}" data-imp="${e.importance}"><span class="t">${esc(tx(e.title))}</span><span class="m">${esc(t("types")[e.type] || e.type)}</span></button>`).join("")}`).join("") + (S.allEvents || all.length <= 16 ? "" : `<button class="more" data-all>${esc(t("showAll"))} · ${all.length}</button>`));
    $("[data-all]", el)?.addEventListener("click", () => { S.allEvents = true; renderAll({ keepCamera: true }); });
  };

  const isBoard = p => /Board|Director|Chair of the Board/i.test(p.role.en || "") && p.status === "active";
  const isTrustee = p => p.zone === "ltbt" && /Trust/i.test(p.role.en || "") && p.status === "active";

  R.governance = m => {
    const people = D.atlas.people;
    const fVotes = parseFloat((D.atlas.facts.find(f => f.id === "class_f_votes") || {}).value) || 0;
    const trustees = people.filter(isTrustee), boardP = people.filter(isBoard).sort((a, b) => b.influence - a.influence);
    const former = people.filter(p => ["ltbt", "capital"].includes(p.zone) && p.status === "former" && /Trust|Board|Director/i.test(p.role.en));
    const el = island(m.id, tx(m.title), { lead: tx(m.lead), far: `<div class="far-v"><b class="num">${fVotes}%</b><span>Class F</span></div><div class="far-faces">${[...trustees, ...boardP].filter((p, i, a) => a.indexOf(p) === i).map(p => avatar(p)).join("")}</div>` }, `
      <div class="sub-h"><span>${esc(t("votes"))}</span><span class="num">Class F ${fVotes}%</span></div>
      <div class="votes"><i data-w="${fVotes}"></i></div>
      <div class="votes-legend">${(D.atlas.shareClasses || []).map(c => `<div><b>${IDX.has(`term:${c.id}`) ? `<abbr class="g" data-term="${c.id}">${esc(c.name)}</abbr>` : esc(c.name)}</b> · ${esc(tx(c.holder))}. ${gloss(tx(c.control))}.</div>`).join("")}</div>
      <div class="sub-h"><span>${gloss(t("trust"))}</span><span class="num">${trustees.length}</span></div>${trustees.map(p => row(p)).join("")}
      <div class="sub-h"><span>${esc(t("board"))}</span><span class="num">${boardP.length}</span></div>${boardP.map(p => row(p)).join("")}
      ${former.length ? collapsible(`${t("former")} · ${former.length}`, former.map(p => row(p, (p.until || "").slice(0, 4))).join("")) : ""}`);
    requestAnimationFrame(() => setTimeout(() => $$(".votes i", el).forEach(i => (i.style.width = i.dataset.w + "%")), 300));
  };

  R.people = () => {
    for (const z of D.atlas.zones.filter(z => z.id !== "ltbt")) {
      const ps = D.atlas.people.filter(p => p.zone === z.id);
      if (!ps.length) continue;
      const act = ps.filter(p => p.status === "active").sort((a, b) => b.influence - a.influence), fm = ps.filter(p => p.status === "former");
      island(`zone-${z.id}`, tx(z.label), { count: String(act.length), far: `<div class="far-faces">${act.map(p => (p.kind === "group" ? `<span class="av">${initials(p)}</span>` : avatar(p))).join("")}</div>` }, act.map(p => row(p)).join("") + (fm.length ? collapsible(`${t("former")} · ${fm.length}`, fm.map(p => row(p, (p.until || "").slice(0, 4))).join("")) : ""));
    }
  };

  const order = { active: 0, preview: 1, legacy: 2, deprecated: 3, retired: 4 };
  R.products = () => {
    for (const c of D.atlas.clusters) {
      const ps = D.atlas.products.filter(p => p.cluster === c.id).sort((a, b) => order[a.status] - order[b.status] || String(b.released).localeCompare(String(a.released)));
      if (!ps.length) continue;
      island(`cluster-${c.id}`, tx(c.label), { count: String(ps.length), far: ps.filter(p => p.status !== "retired").slice(0, 5).map(p => `<div class="far-l">${esc(p.name)}</div>`).join("") }, ps.map(p => `<button class="row noav" data-open="product:${p.id}"><span class="who"><span class="nm">${esc(p.name)}</span><span class="rl">${esc(tx(p.description))}</span></span><span class="side">${p.status === "active" ? esc(String(p.released || "").slice(0, 4)) : `<span class="st ${p.status}">${esc(t(p.status))}</span>`}</span></button>`).join(""));
    }
  };

  R.glossary = m => {
    const cats = { governance: 1, finance: 2, safety: 3, models: 4, platform: 5, product: 6 };
    island(m.id, tx(m.title), { count: String(D.terms.length), lead: tx(m.lead), far: `<div class="far-terms">${D.terms.slice(0, 10).map(g => esc(g.term)).join(" · ")}</div>` }, [...D.terms].sort((a, b) => (cats[a.category] || 9) - (cats[b.category] || 9)).map(g => `<button class="term" data-open="term:${g.id}"><b>${esc(g.term)}</b><span>${esc(tx(g.definition))}</span></button>`).join(""));
  };

  R.cards = m => { // generic renderer for new topics: any array of {id,name,description,sources}
    const el = island(m.id, tx(m.title), { lead: tx(m.lead) }, "");
    const [file, key] = (m.source || "").split("#");
    getJSON(`/data/${file}`).then(d => {
      const items = d[key] || [];
      for (const it of items) IDX.set(`product:${it.id}`, { kind: "product", status: "active", ...it });
      $(".ib", el).innerHTML = items.map(p => `<button class="row noav" data-open="product:${p.id}"><span class="who"><span class="nm">${esc(p.name)}</span><span class="rl">${esc(tx(p.description))}</span></span></button>`).join("");
      $(".ih .ic", el).textContent = items.length; relayoutSoon();
    }).catch(() => el.parentElement.remove());
  };

  // ---------------------------------------------------------------- library: everything Anthropic publishes
  // data/library.json (catalog, written by scripts/library.mjs, no model) + data/library-notes.json (Russian cards
  // and reading paths, optional). Loaded after the board is on screen; the board never waits for it.
  const LT = {
    ru: { start: "С чего начать", fresh: "Новое в библиотеке", shelves: "Библиотека", who: "Кому полезно", todo: "Что сделать", open: "Читать оригинал", all: "Все", more: "Показать ещё", filter: "Найти в разделе", items: "материалов", source: "Источник", inShelf: "Ещё в разделе", aud: { learners: "Изучающим ИИ", developers: "Разработчикам", researchers: "Исследователям", business: "Бизнесу", policy: "Политикам и журналистам", everyone: "Всем" } },
    en: { start: "Start here", fresh: "New in the library", shelves: "Library", who: "Useful for", todo: "What to do", open: "Read the original", all: "All", more: "Show more", filter: "Search this section", items: "items", source: "Source", inShelf: "More in this section", aud: { learners: "Learning AI", developers: "Developers", researchers: "Researchers", business: "Business", policy: "Policy and press", everyone: "Everyone" } },
    uz: { start: "Nimadan boshlash", fresh: "Kutubxonada yangi", shelves: "Kutubxona", who: "Kimga foydali", todo: "Nima qilish kerak", open: "Asl manbani o‘qish", all: "Hammasi", more: "Yana ko‘rsatish", filter: "Bo‘limda qidirish", items: "material", source: "Manba", inShelf: "Bo‘limda yana", aud: { learners: "AI o‘rganuvchilarga", developers: "Dasturchilarga", researchers: "Tadqiqotchilarga", business: "Biznesga", policy: "Siyosatchilar va jurnalistlarga", everyone: "Hammaga" } }
  };
  const L = k => (LT[S.lang] || LT.ru)[k] ?? LT.ru[k];
  const audName = w => L("aud")[w] || w;
  let LIB = null;
  async function loadLibrary() {
    const [lib, notes] = await Promise.all([getJSON("/data/library.json"), getJSON("/data/library-notes.json").catch(() => null)]);
    const items = (lib.items || []).filter(i => !i.gone);
    if (!Array.isArray(lib.sections)) lib.sections = [];
    LIB = { sections: lib.sections, who: lib.who || {}, items, notes: notes?.notes || {}, paths: notes?.paths || [] };
    for (const i of items) IDX.set(`lib:${i.id}`, { kind: "lib", ...i });
    for (const s of lib.sections) IDX.set(`shelf:${s.id}`, { kind: "shelf", ...s, name: s.ru });
  }
  const note = i => (S.lang !== "en" ? LIB.notes[i.id] : null);
  const libT = i => note(i)?.t || i.title;
  const libS = i => note(i)?.s || i.desc || "";
  const libW = i => LIB.notes[i.id]?.w || LIB.who[i.section] || [];
  const libDate = i => i.date || i.added || "";
  const secName = id => tx(LIB.sections.find(s => s.id === id));
  const host2 = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const shortDate = d => (d ? fmtDate(d, { day: "numeric", month: "short", year: d.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "numeric" }) : "");
  const libRow = (i, sub, side) => `<button class="row noav lib" data-open="lib:${i.id}"><span class="who"><span class="nm">${esc(libT(i))}</span><span class="rl">${esc(sub ?? libS(i))}</span></span>${side ? `<span class="side num">${esc(side)}</span>` : ""}</button>`;
  const freshItems = () => LIB.items.filter(i => libDate(i) && !/^docs-/.test(i.section)).sort((a, b) => libDate(b).localeCompare(libDate(a)));

  R.library = () => {
    if (!LIB) return;
    // 1. reading paths: one quiet switch, one list
    if (LIB.paths.length) {
      const pid = LIB.paths.some(p => p.id === S.libPath) ? S.libPath : LIB.paths[0].id;
      const body = () => { const p = LIB.paths.find(x => x.id === (S.libPath || pid)); return `<div class="seg" role="tablist">${LIB.paths.map(x => `<button role="tab" data-path="${x.id}" aria-selected="${x.id === p.id}">${esc(tx(x))}</button>`).join("")}</div><ol class="path">${p.items.map(x => IDX.get(`lib:${x.id}`)).filter(Boolean).map((i, n) => `<li>${libRow(i, (S.lang !== "en" && p.items[n] && p.items.find(y => y.id === i.id)?.why) || secName(i.section))}</li>`).join("")}</ol>`; };
      const el = island("lib-start", L("start"), { far: LIB.paths.map(p => `<div class="far-l">${esc(tx(p))}</div>`).join("") }, body());
      el.addEventListener("click", e => { const b = e.target.closest("[data-path]"); if (!b) return; S.libPath = b.dataset.path; $(".ib", el).innerHTML = body(); relayoutSoon(); });
    }
    // 2. what is new
    const fresh = freshItems().slice(0, 8);
    island("lib-new", L("fresh"), { far: fresh.slice(0, 5).map(i => `<div class="far-l">${esc(libT(i))}</div>`).join("") }, fresh.map(i => libRow(i, `${secName(i.section)} · ${shortDate(libDate(i))}`)).join(""));
    // 3. the shelves: every section, its size and its latest title
    const secs = LIB.sections.map(s => ({ s, list: LIB.items.filter(i => i.section === s.id) })).filter(x => x.list.length);
    island("lib-shelves", L("shelves"), { count: String(LIB.items.length), far: `<div class="far-v"><b class="num">${LIB.items.length}</b><span>${esc(L("items"))}</span></div>` },
      secs.map(({ s, list }) => { const top = [...list].sort((a, b) => libDate(b).localeCompare(libDate(a)))[0]; return `<button class="row noav shelf" data-open="shelf:${s.id}"><span class="who"><span class="nm">${esc(tx(s))}</span><span class="rl">${libDate(top) && !/^docs-/.test(s.id) ? `${esc(shortDate(libDate(top)))} · ` : ""}${esc(libT(top))}</span></span><span class="side num">${list.length}</span></button>`; }).join(""));
  };

  // shelf sheet: search + audience filter + list; long lists grow in pages of 60
  const SH = { q: "", aud: "all", lim: 60 };
  function fillShelf() {
    const host = $("#sheet-body .shelf-list"); if (!host) return;
    const sec = host.dataset.shelf;
    const n = s => s.toLowerCase();
    const words = n(SH.q).split(/\s+/).filter(Boolean);
    let list = LIB.items.filter(i => i.section === sec && (SH.aud === "all" || libW(i).includes(SH.aud)) && (!words.length || words.every(w => n(`${libT(i)} ${i.title} ${libS(i)} ${i.desc || ""} ${i.group || ""}`).includes(w))));
    const docs = /^docs-/.test(sec);
    if (!docs) list.sort((a, b) => libDate(b).localeCompare(libDate(a)));
    const shown = list.slice(0, SH.lim);
    let html = "", g = null;
    for (const i of shown) {
      if (docs && i.group !== g) { g = i.group; html += `<div class="day-h">${esc(g || "")}</div>`; }
      html += libRow(i, undefined, docs ? "" : shortDate(libDate(i)));
    }
    host.innerHTML = (html || `<div class="empty">${esc(t("nothing"))}</div>`) + (list.length > SH.lim ? `<button class="more" data-lim>${esc(L("more"))} · ${list.length - SH.lim}</button>` : "");
  }

  // ---------------------------------------------------------------- sheet (one template for every entity kind)
  function linksHTML(links) {
    if (!links) return "";
    const ks = ["wikipedia", "official", "docs", "github", "site", "linkedin", "x", "wikidata"].filter(k => links[k]);
    return ks.length ? `<div class="links">${ks.map(k => `<a href="${esc(safeUrl(links[k]))}" target="_blank" rel="noopener">${esc(t(k))}</a>`).join("<i>·</i>")}</div>` : "";
  }
  function sourcesHTML(e) {
    if (!e.sources?.length) return "";
    return `<div class="blk"><h4>${esc(t("sources"))}</h4><div class="sources">${e.sources.map(s => `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("")}</div>${e.verifiedAt ? `<div class="verified">${esc(t("verified"))} ${esc(fmtDate(e.verifiedAt))}</div>` : ""}</div>`;
  }
  const relEvents = (id, name) => D.events.filter(e => (e.entities || []).includes(id) || (name && name.length > 5 && (tx(e.title) + " " + e.title.en).includes(name))).slice(0, 8);
  const eventsHTML = evs => (evs.length ? `<div class="blk"><h4>${esc(t("events"))}</h4>${evs.map(e => `<button class="ev" data-open="event:${e.id}"><span class="t">${esc(tx(e.title))}</span><span class="m">${esc(fmtDate(e.date))}</span></button>`).join("")}</div>` : "");
  const kv = pairs => { const p = pairs.filter(([, v]) => v); return p.length ? `<dl class="kv">${p.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""; };
  function relRow(x, sub) {
    const pc = picOf(x); return `<button class="row${pc ? "" : " noav"}" data-open="${ref(x)}:${x.id}">${pc}<span class="who"><span class="nm">${esc(x.name || x.term || tx(x.title))}</span><span class="rl">${esc(sub || "")}</span></span><span class="chev">›</span></button>`;
  }

  const SHEET = {
    lib(i) {
      const n = note(i), d = libDate(i), sib = LIB.items.filter(x => x.section === i.section && x.id !== i.id && (/^docs-/.test(i.section) ? x.group === i.group : true)).sort((a, b) => libDate(b).localeCompare(libDate(a))).slice(0, 4);
      return `<div class="hd"><div><div class="cap">${esc(secName(i.section))}${d ? ` · ${esc(fmtDate(d))}` : ""}</div><h3 data-copy style="margin-top:4px">${esc(libT(i))}</h3>${n?.t && n.t !== i.title ? `<div class="sub">${esc(i.title)}</div>` : ""}</div></div>
        ${libS(i) ? `<p class="lead">${gloss(libS(i))}</p>` : ""}
        ${n?.d ? `<div class="todo"><span>${esc(L("todo"))}</span>${esc(n.d)}</div>` : ""}
        <a class="go" href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener">${esc(L("open"))}<span>${esc(host2(i.url))}</span><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 2h6v6M10 2 2 10"/></svg></a>
        ${kv([[L("who"), esc(libW(i).map(audName).join(", "))]])}
        ${sib.length ? `<div class="blk"><h4>${esc(L("inShelf"))}</h4>${sib.map(x => libRow(x, undefined, /^docs-/.test(x.section) ? "" : shortDate(libDate(x)))).join("")}</div>` : ""}`;
    },
    shelf(s) {
      const list = LIB.items.filter(i => i.section === s.id);
      const auds = Object.keys(L("aud")).filter(w => list.some(i => libW(i).includes(w)));
      return `<div class="hd"><div><div class="cap">${esc(L("shelves"))} · <span class="num">${list.length}</span></div><h3 data-copy style="margin-top:4px">${esc(tx(s))}</h3></div></div>
        <div class="shelf-tools">${list.length > 12 ? `<input class="sf" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(L("filter"))}" value="${esc(SH.q)}">` : ""}${auds.length > 1 && list.length > 8 ? `<div class="chips">${["all", ...auds].map(w => `<button data-aud="${w}" aria-pressed="${SH.aud === w}">${esc(w === "all" ? L("all") : audName(w))}</button>`).join("")}</div>` : ""}</div>
        <div class="shelf-list" data-shelf="${esc(s.id)}"></div>`;
    },
    person(p) {
      const up = D.atlas.edges.filter(e => e.to === p.id).map(e => [e, byId(e.from)]).filter(x => x[1]);
      const down = D.atlas.edges.filter(e => e.from === p.id).map(e => [e, byId(e.to)]).filter(x => x[1]);
      const prods = D.atlas.products.filter(x => x.owners.includes(p.id)).map(x => IDX.get(`product:${x.id}`));
      return `<div class="hd">${p.kind === "group" ? icon(p, "lg") : avatar(p, "lg")}<div><h3 data-copy>${esc(p.name)}</h3><div class="sub">${esc(tx(p.role))}</div></div></div>
        ${p.bio ? `<p class="lead">${gloss(tx(p.bio))}</p>` : ""}
        ${linksHTML(p.links)}
        ${kv([[t("status"), esc(p.status === "former" ? t("formerS") : t("activeP"))], [t("since"), esc(fmtDate(p.since))], [t("until"), esc(fmtDate(p.until))], [t("zone"), esc(zoneLabel(p.zone))]])}
        ${up.length || down.length ? `<div class="blk"><h4>${esc(t("related"))}</h4>${up.map(([e, x]) => relRow(x, e.type === "gov" ? t("oversightBy") : t("reports"))).join("")}${down.map(([e, x]) => relRow(x, e.type === "gov" ? t("oversees") : t("manages"))).join("")}</div>` : ""}
        ${prods.length ? `<div class="blk"><h4>${esc(t("products"))}</h4>${prods.map(x => relRow(x, clusterLabel(x.cluster))).join("")}</div>` : ""}
        ${eventsHTML(relEvents(p.id, p.name))}${sourcesHTML(p)}`;
    },
    product(p) {
      const owners = (p.owners || []).map(byId).filter(Boolean);
      return `<div class="hd"><div><div class="cap">${esc(clusterLabel(p.cluster))}</div><h3 data-copy style="margin-top:2px">${esc(p.name)}</h3>${p.status !== "active" ? `<div class="sub"><span class="st ${p.status}">${esc(t(p.status))}</span></div>` : ""}</div></div>
        <p class="lead">${gloss(tx(p.description))}</p>${linksHTML(p.links)}
        ${kv([[t("released"), esc(fmtDate(p.released))], [t("metrics"), p.metrics ? gloss(p.metrics) : ""]])}
        ${p.children?.length ? `<div class="blk"><h4>${esc(t("children"))}</h4>${p.children.map(c => `<div class="child"><span>${c.docs ? `<a href="${esc(safeUrl(c.docs))}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}${c.apiId ? `<br><code>${esc(c.apiId)}</code>` : ""}${c.note ? `<br><span class="cap">${esc(tx(c.note))}</span>` : ""}</span><span class="r">${c.status && c.status !== "active" ? `<span class="st ${c.status}">${esc(t(c.status))}</span><br>` : ""}${esc(fmtDate(c.released, { day: "numeric", month: "long", year: "numeric" }))}</span></div>`).join("")}</div>` : ""}
        ${owners.length ? `<div class="blk"><h4>${esc(t("owners"))}</h4>${owners.map(x => relRow(x, tx(x.role))).join("")}</div>` : ""}
        ${eventsHTML(relEvents(p.id, p.name.split(/[,&(]/)[0].trim()))}${sourcesHTML(p)}`;
    },
    event(e) {
      const ents = (e.entities || []).map(byId).filter(Boolean);
      return `<div class="hd"><div><div class="cap">${esc(t("types")[e.type] || e.type)} · ${esc(fmtDate(e.date))}</div><h3 data-copy style="margin-top:4px">${esc(tx(e.title))}</h3></div></div>
        <p class="lead">${gloss(tx(e.summary))}</p>
        ${ents.length ? `<div class="blk"><h4>${esc(t("related"))}</h4>${ents.map(x => relRow(x, x.isPerson ? tx(x.role) : clusterLabel(x.cluster))).join("")}</div>` : ""}${sourcesHTML(e)}`;
    },
    term(g) {
      const re = new RegExp([g.term, ...(g.aliases || [])].map(w => w.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&")).join("|"), "i");
      const where = [...D.atlas.products, ...D.atlas.people].filter(x => re.test(tx(x.description) + tx(x.bio) + (x.metrics || ""))).slice(0, 8).map(x => byId(x.id));
      return `<div class="hd"><div><h3 data-copy>${esc(g.term)}</h3>${g.aliases?.length ? `<div class="sub">${esc(g.aliases.join(" · "))}</div>` : ""}</div></div>
        <p class="lead">${esc(tx(g.definition))}</p>${linksHTML(g.links)}
        ${where.length ? `<div class="blk"><h4>${esc(t("seeAlso"))}</h4>${where.map(x => relRow(x, x.isPerson ? tx(x.role) : clusterLabel(x.cluster))).join("")}</div>` : ""}${sourcesHTML(g)}`;
    },
    fact(f) {
      return `<div class="hd"><div><div class="cap">${esc(tx(f.label))}</div><h3 data-copy class="num" style="margin-top:2px;font-size:40px;letter-spacing:-.03em">${esc(f.value)}</h3></div></div>
        <p class="lead">${gloss(tx(f.note))}</p>${kv([[t("asOf"), esc(fmtDate(f.asOf))]])}${sourcesHTML(f)}`;
    }
  };

  function openEntity(kind, id, { push = true, fromHash = false } = {}) {
    const e = IDX.get(`${kind}:${id}`);
    if (!e) return;
    if (push && (!S.stack.length || S.stack.at(-1).id !== id)) S.stack.push({ kind, id });
    if (kind === "shelf" && push) Object.assign(SH, { q: "", aud: "all", lim: 60 });
    $("#sheet-body").innerHTML = SHEET[kind](e);
    if (kind === "shelf") fillShelf();
    $("#sheet-body").scrollTop = 0;
    const name = x => (x.kind === "lib" ? libT(x) : x.kind === "shelf" ? tx(x) : x.name || x.term || tx(x.title) || tx(x.label));
        const prev = S.stack.length > 1 ? S.stack.at(-2) : null;
    $("#crumbs").innerHTML = prev ? `<button data-crumb="${S.stack.length - 2}"><svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 1.5 1.5 7.5l6 6"/></svg>${esc(name(IDX.get(`${prev.kind}:${prev.id}`)))}</button>` : "";
    const body = $("#sheet-body"); body.classList.remove("push"); if (prev && push) { void body.offsetWidth; body.classList.add("push"); }
    const wasOn = $("#sheet").classList.contains("on");
    $("#sheet").classList.add("on"); $("#scrim").classList.add("on"); $("#sheet").inert = false; $("#sheet").removeAttribute("aria-hidden"); dismissHint();
    if (!wasOn) { openEntity.ret = document.activeElement; setTimeout(() => $("#x").focus({ preventScroll: true }), 30); }
    S.focus = kind === "person" ? id : null; drawLinks();
    if (!fromHash) try { history.replaceState(null, "", `#/${kind}/${encodeURIComponent(id)}`); } catch {}
  }
  function closeSheet() {
    const wasOn = $("#sheet").classList.contains("on");
    $("#sheet").classList.remove("on"); $("#scrim").classList.remove("on"); $("#sheet").inert = true; $("#sheet").setAttribute("aria-hidden", "true"); S.stack = []; S.focus = null; drawLinks();
    if (wasOn && openEntity.ret?.isConnected) openEntity.ret.focus({ preventScroll: true });
    try { history.replaceState(null, "", location.pathname + location.search); } catch {}
  }
  function back() { if (S.stack.length > 1) { S.stack.pop(); const s = S.stack.at(-1); openEntity(s.kind, s.id, { push: false }); } else closeSheet(); }

  // ---------------------------------------------------------------- tooltip
  function showTip(anchor, title, body) {
    const el = $("#tip"); el.innerHTML = `<b>${esc(title)}</b>${esc(body || "")}`;
    const r = anchor.getBoundingClientRect(); el.classList.add("show");
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8) + "px";
    el.style.top = (r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10) + "px";
  }
  const hideTip = () => $("#tip").classList.remove("show");

  // ---------------------------------------------------------------- hero (desktop): today in one glance
  const MAST = {
    ru: { tag: "Ежедневный монитор компании Anthropic по открытым источникам: что происходит, кто принимает решения и что она публикует. Каждый факт со ссылкой на источник.", start: "Новичку: начните с подборки «С чего начать»", ago: "последнее событие", daysAgo: n => `Тихий день · ${new Intl.PluralRules("ru").select(n) === "one" ? `${n} день` : new Intl.PluralRules("ru").select(n) === "few" ? `${n} дня` : `${n} дней`} без новых событий`, lib: "Библиотека", method: "Как мы проверяем", latest: "Последнее событие", official: "Anthropic · официально", rss: "RSS", quiet: "За сегодня новых событий нет.", gone: "Ссылка устарела: такой записи больше нет", digests: "Сводки" },
    en: { tag: "A daily monitor of Anthropic from public sources: what is happening, who decides and what it publishes. Every fact links to its source.", start: "New here? Start with the “Start here” reading paths", daysAgo: n => `Quiet day · no new events for ${n} day${n === 1 ? "" : "s"}`, lib: "Library", method: "How we verify", latest: "Latest event", official: "Anthropic · official", rss: "RSS", quiet: "No new events today.", gone: "This link is out of date", digests: "Digests" },
    uz: { tag: "Anthropic haqida ochiq manbalar asosidagi kundalik monitor: nima bo‘lyapti, kim qaror qiladi va u nimalarni nashr etadi. Har bir fakt manbaga havola bilan.", start: "Yangi boshlovchilarga: «Nimadan boshlash» to‘plamidan boshlang", daysAgo: n => `Tinch kun · ${n} kun yangi voqea yo‘q`, lib: "Kutubxona", method: "Qanday tekshiramiz", latest: "So‘nggi voqea", official: "Anthropic · rasmiy", rss: "RSS", quiet: "Bugun yangi voqealar yo‘q.", gone: "Havola eskirgan", digests: "Xulosalar" }
  };
  const M = k => MAST[S.lang][k] || MAST.ru[k];
  const METHOD_URL = "https://github.com/SharipovAkhror/anthropic-atlas/blob/main/docs/METHODOLOGY.md";
  function stampText() {
    const dg = S.latest; if (!dg) return `${t("updated")} ${fmtDate(D.atlas.meta.updatedAt)}`;
    const when = new Date(dg.generatedAt), days = Math.floor((Date.now() - when) / 864e5);
    const day = days < 1 && new Date().toDateString() === when.toDateString() ? t("today") : days < 2 ? t("yesterday") : when.toLocaleDateString(locale(), { day: "numeric", month: "long" });
    return `${t("updated")} ${day} ${t("at")} ${when.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}`;
  }
  function heroHTML() {
    const dg = S.digest, date = dg?.date || D.atlas.meta.updatedAt;
    const lead = leadStory(), past = D.digests.slice(0, 7), MQ = MAST[S.lang].daysAgo || MAST.ru.daysAgo;
    return `<p class="hero-d">${esc(M("tag"))}</p><div class="hero-k">${esc(fmtDate(date, { weekday: "long", day: "numeric", month: "long" }))}<span>${esc(stampText())}</span></div>
      ${lead.k ? `<div class="hero-e">${esc(lead.k)}</div>` : ""}
      <h1>${lead.ref ? `<a href="#" data-open="${esc(lead.ref)}">${esc(lead.h)}</a>` : esc(lead.h)}</h1>
      ${lead.s ? `<p class="hero-s">${gloss(lead.s)}</p>` : ""}
      ${lead.quiet ? `<p class="quiet">${esc(lead.gap > 1 ? MQ(lead.gap) : M("quiet"))}</p>` : ""}
      <div class="hero-l">${LIB?.paths.length ? `<button data-jump="lib-start">${esc(M("start"))}</button>` : ""}${LIB ? `<button data-jump="lib-shelves">${esc(M("lib"))} <span class="num">${LIB.items.length}</span></button>` : ""}<a href="${METHOD_URL}" target="_blank" rel="noopener">${esc(M("method"))}</a><a href="/data/feed.xml" target="_blank" rel="noopener">${esc(M("rss"))}</a>${past.length > 1 ? `<span class="past-h">${esc(M("digests"))}: ${past.map(h => `<button data-d="${h.date}" class="${h.date === dg?.date ? "on" : ""}">${esc(fmtDate(h.date, { day: "numeric", month: "short" }))}</button>`).join("")}</span>` : ""}</div>`;
  }

  // ---------------------------------------------------------------- connections between people (desktop board)
  function drawLinks() {
    const svg = $("#links"), top = $("#links-top");
    if (!svg || phone() || !D) return;
    const focus = S.hover || S.focus;
    for (const g of [svg, top]) { g.setAttribute("width", BW); g.setAttribute("height", BH); g.setAttribute("viewBox", `0 0 ${BW} ${BH}`); }
    const vis = id => $$(`.slot [data-open="person:${CSS.escape(id)}"]`).filter(el => !el.closest(".collapse:not(.open)"));
    const slotBox = new Map();
    const sb = el => { const s = el.closest(".slot"); if (!slotBox.has(s)) slotBox.set(s, { s, x: parseFloat(s.style.left), y: parseFloat(s.style.top), w: s.offsetWidth, h: s.offsetHeight }); return slotBox.get(s); };
    let base = "", hot = "", ports = "", hotPorts = "";
    const rel = new Set();
    for (const e of D.atlas.edges) {
      const A = vis(e.from), B = vis(e.to);
      if (!A.length || !B.length) continue;
      let best = null;
      for (const a of A) for (const b of B) { const pa = boxOf(a), pb = boxOf(b), d = Math.hypot(pa.x - pb.x, pa.y - pb.y) + (a.closest(".slot") === b.closest(".slot") ? 400 : 0); if (!best || d < best.d) best = { a, b, pa, pb, d }; }
      const ia = sb(best.a), ib = sb(best.b);
      const ya = best.pa.y + best.pa.h / 2, yb = best.pb.y + best.pb.h / 2;
      let d, xa, xb;
      if (ia.s === ib.s || Math.abs(ia.x - ib.x) < 2) { // same column: loop out on the left edge
        xa = ia.x; xb = ib.x; const k = Math.min(GAP * .8, 22 + Math.abs(yb - ya) * .12);
        d = `M${xa} ${ya}C${xa - k} ${ya} ${xb - k} ${yb} ${xb} ${yb}`;
      } else {
        const right = ib.x > ia.x;
        xa = right ? ia.x + ia.w : ia.x; xb = right ? ib.x : ib.x + ib.w;
        const c1 = xa + (xb - xa) * .38, c2 = xb - (xb - xa) * .38;
        d = `M${xa} ${ya}C${c1} ${ya} ${c2} ${yb} ${xb} ${yb}`;
      }
      const on = focus && (e.from === focus || e.to === focus);
      const path = `<path class="ln ${e.type}" d="${d}"/>`;
      const pt = `<circle cx="${xa}" cy="${ya}" r="3.5"/><circle cx="${xb}" cy="${yb}" r="3.5"/>`;
      if (on) { hot += path; hotPorts += pt; rel.add(e.from); rel.add(e.to); } else { base += path; ports += pt; }
    }
    svg.innerHTML = `<g class="${focus ? "dim" : ""}">${base}</g>`;
    top.innerHTML = hot ? `<g class="hot">${hot}<g class="pt">${hotPorts}</g></g>` : "";
    $$(".slot .row.rel").forEach(r => r.classList.remove("rel"));
    if (focus) rel.forEach(id => vis(id).forEach(r => r.classList.add("rel")));
  }

  // ---------------------------------------------------------------- desktop: an open space you can move and zoom
  // At 100% it reads like a page: the hero, then cards in as many columns as fit the window. Drag, scroll or use
  // the trackpad to move; pinch, Ctrl/⌘ + wheel or + and − to zoom; 0 shows everything, 1 returns home.
  // Zoomed out, the real cards stay in place and each one carries a readable label sized for the screen.
  let GAP = 24, BW = 0, BH = 0, COLW = 360, HOME = { x: 0, y: 0, s: 1 }, ZH = 1, MODE = "page", switching = false;
  const cam = { x: 0, y: 0, s: 1 };
  let anim = 0, inertiaRaf = 0;
  const vw = () => $("#view").clientWidth, vh = () => $("#view").clientHeight;
  const FAR = .42;
  function layout() {
    const b = board();
    const slots = $$(".slot", b), hero = $(".hero", b);
    if (phone()) { b.style.height = b.style.width = ""; slots.forEach(s => { s.style.left = s.style.top = s.style.width = ""; }); return; }
    const gut = clamp(vw() * .036, 20, 72);
    // very wide screens: the page is drawn a little larger instead of in tiny type with empty margins
    ZH = vw() >= 2000 ? Math.min(1.4, vw() / 1880) : 1;
    const W = Math.min(1760, vw() / ZH - gut * 2);
    GAP = W >= 1800 ? 32 : W >= 1200 ? 24 : 20;
    const n = clamp(Math.floor((W + GAP) / (330 + GAP)), 1, 6);
    COLW = (W - GAP * (n - 1)) / n;
    b.style.setProperty("--colw", COLW + "px");
    // map labels: whole words only, so the longest word sets the largest size that still fits the card
    for (const fb of $$(".flabel b", b)) { const L = Math.max(6, ...fb.textContent.split(/\s+/).map(w => w.length)); fb.style.setProperty("--fmax", Math.min(COLW / 6, (COLW * (1 - 2 / 14) - 4) / (L * .68)).toFixed(1) + "px"); }
    let top = 0;
    if (hero) { hero.style.width = W + "px"; top = hero.offsetHeight; }
    slots.forEach(s => { s.style.width = COLW + "px"; });
    const hs = slots.map(s => s.offsetHeight);
    const pack = k => { const cols = new Array(k).fill(top), pos = hs.map(h => { const c = cols.indexOf(Math.min(...cols)); const p = [c, cols[c]]; cols[c] += h + GAP; return p; }); return { k, pos, W: k * COLW + (k - 1) * GAP, H: Math.max(top, Math.max(...cols) - GAP) }; };
    let L = pack(n);
    HOME = { s: ZH, x: Math.round((vw() - L.W * ZH) / 2), y: 0 };
    if (MODE === "map") { // zoomed out: spread the same cards into a wider grid that fills the screen's shape
      const target = vw() / vh();
      for (let k = n + 1; k <= 14; k++) { const c = pack(k); if (Math.abs(Math.log(c.W / c.H / target)) < Math.abs(Math.log(L.W / L.H / target))) L = c; }
    }
    slots.forEach((s, i) => { s.style.left = L.pos[i][0] * (COLW + GAP) + "px"; s.style.top = L.pos[i][1] + "px"; });
    BW = L.W; BH = L.H;
    b.style.width = BW + "px"; b.style.height = BH + "px";
    drawLinks(); drawMap();
  }
  let relayoutT = 0;
  function relayoutSoon(ms = 480) { clearTimeout(relayoutT); relayoutT = setTimeout(layout, ms); }
  function boxOf(el) { // board coordinates of any element inside the board
    let x = 0, y = 0, n = el;
    while (n && n !== board()) { if (n.classList.contains("slot")) { x += parseFloat(n.style.left) || 0; y += parseFloat(n.style.top) || 0; } else { x += n.offsetLeft; y += n.offsetTop; } n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function setMode(m, px, py) {
    if (m === MODE || phone() || switching) return;
    switching = true;
    const cx = px ?? vw() / 2, cy = py ?? vh() / 2;
    let anchor = null, best = Infinity;
    for (const sl of $$(".slot", board())) { const x = cam.x + (parseFloat(sl.style.left) + sl.offsetWidth / 2) * cam.s, y = cam.y + (parseFloat(sl.style.top) + sl.offsetHeight / 2) * cam.s, d = Math.hypot(x - cx, y - cy); if (d < best) { best = d; anchor = { sl, x: cam.x + parseFloat(sl.style.left) * cam.s, y: cam.y + parseFloat(sl.style.top) * cam.s }; } }
    MODE = m; const b = board(); b.classList.add("swap"); b.classList.toggle("far", m === "map"); layout(); void b.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.remove("swap")));
    if (anchor) { cam.x = anchor.x - parseFloat(anchor.sl.style.left) * cam.s; cam.y = anchor.y - parseFloat(anchor.sl.style.top) * cam.s; }
    switching = false;
  }
  let applyRaf = 0;
  function apply(px, py) {
    if (phone()) return;
    if (!switching && !tweening) { if (cam.s < FAR && MODE === "page") setMode("map", px, py); else if (cam.s >= FAR + .12 && MODE === "map") setMode("page", px, py); }
    const w = vw(), h = vh(), m = 200; // some of the board always stays on screen; a board smaller than the screen sits centred
    const bw = BW * cam.s, bh = BH * cam.s;
    cam.x = bw <= w ? (w - bw) / 2 : clamp(cam.x, m - bw, w - m);
    cam.y = bh <= h ? Math.min((h - bh) / 2, Math.max(24, cam.y)) : clamp(cam.y, m - bh, h * .35);
    const b = board();
    b.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.s})`;
    b.style.setProperty("--inv", 1 / cam.s);
    b.classList.toggle("far", MODE === "map");
    if (!applyRaf) applyRaf = requestAnimationFrame(() => { applyRaf = 0; drawMap(); });
  }
  let tweening = false;
  function tween(to, dur = 560) {
    cancelAnimationFrame(anim); cancelAnimationFrame(inertiaRaf);
    if (reduced()) { Object.assign(cam, to); apply(); return; }
    tweening = true;
    const from = { ...cam }, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      cam.x = from.x + (to.x - from.x) * e; cam.y = from.y + (to.y - from.y) * e; cam.s = from.s + (to.s - from.s) * e;
      if (k >= 1) tweening = false;
      apply(); if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  // never smaller than a bit past "everything on screen": further out there is nothing left to see
  const minScale = () => clamp(Math.min(vw() / BW, vh() / BH) * .7, .06, .5);
  function zoomAt(ns, px, py, animate = false) {
    ns = clamp(ns, minScale(), 2.5);
    if (ns < FAR && MODE === "page") setMode("map", px, py); else if (ns >= FAR + .12 && MODE === "map") setMode("page", px, py);
    const bx = (px - cam.x) / cam.s, by = (py - cam.y) / cam.s;
    const to = { s: ns, x: px - bx * ns, y: py - by * ns };
    animate ? tween(to, 320) : (Object.assign(cam, to), apply(px, py));
  }
  const sheetW = () => ($("#sheet").classList.contains("on") ? $("#sheet").offsetWidth + 24 : 0);
  function fitAll(animate = true) {
    setMode("map");
    const w = vw(), h = vh(), s = clamp(Math.min((w - 64) / BW, (h - 64) / BH), .08, 1);
    const to = { s, x: (w - BW * s) / 2, y: Math.max(24, (h - BH * s) / 2) };
    animate ? tween(to, 700) : (Object.assign(cam, to), apply());
  }
  function goHome(animate = true) { setMode("page"); animate ? tween({ ...HOME }) : (Object.assign(cam, HOME), apply()); }
  function focusIsland(slot, animate = true) {
    setMode("page");
    const b = boxOf(slot), w = vw() - sheetW(), h = vh();
    const s = clamp(Math.min((w - 96) / b.w, (h - 64) / b.h), .9, 1.25);
    const to = { s, x: (w - b.w * s) / 2 - b.x * s, y: b.h * s + 64 < h ? (h - b.h * s) / 2 - b.y * s : 40 - b.y * s };
    animate ? tween(to) : (Object.assign(cam, to), apply());
  }
  function focusEl(el) {
    setMode("page");
    const b = boxOf(el), w = vw() - sheetW(), h = vh(), s = Math.max(cam.s, 1);
    tween({ s, x: w / 2 - (b.x + b.w / 2) * s, y: h * .38 - (b.y + b.h / 2) * s });
  }
  // minimap: appears while you move, fades when you stop
  function drawMap() {
    const mm = $("#minimap"); if (!mm || !BW || phone() || (!drawMap.user && !mm.classList.contains("on"))) return;
    const cv = $("canvas", mm), W = 300, k = W / BW, H = Math.round(Math.min(240, BH * k)), kk = Math.min(k, H / BH);
    if (cv.height !== H) { cv.height = H; cv.style.height = H / 2 + "px"; }
    const g = cv.getContext("2d");
    g.clearRect(0, 0, W, H); g.fillStyle = "rgba(0,0,0,.12)";
    for (const sl of $$(".slot", board())) { const x = parseFloat(sl.style.left) * kk, y = parseFloat(sl.style.top) * kk; g.beginPath(); g.roundRect ? g.roundRect(x, y, sl.offsetWidth * kk, sl.offsetHeight * kk, 3) : g.rect(x, y, sl.offsetWidth * kk, sl.offsetHeight * kk); g.fill(); }
    const rx = -cam.x / cam.s * kk, ry = -cam.y / cam.s * kk, rw = vw() / cam.s * kk, rh = vh() / cam.s * kk;
    g.strokeStyle = "#0071e3"; g.lineWidth = 2; g.fillStyle = "rgba(0,113,227,.07)";
    g.beginPath(); g.roundRect ? g.roundRect(rx, ry, rw, rh, 4) : g.rect(rx, ry, rw, rh); g.fill(); g.stroke();
    mm._k = kk;
    if (!drawMap.user) return;
    mm.classList.add("on"); clearTimeout(drawMap.t);
    drawMap.t = setTimeout(() => { if (!mm.matches(":hover")) mm.classList.remove("on"); }, 1800);
  }
  function bindCanvas() {
    const view = $("#view");
    const ptrs = new Map();
    let drag = null, pinch = null, moved = false, vel = { x: 0, y: 0 }, last = null;
    const loc = e => { const r = view.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const interactive = t => t.closest("input, textarea, select, a[href]:not([href='#'])");
    view.addEventListener("pointerdown", e => {
      if (phone() || (e.pointerType === "mouse" && e.button !== 0) || interactive(e.target)) return;
      cancelAnimationFrame(anim); cancelAnimationFrame(inertiaRaf); tweening = false;
      ptrs.set(e.pointerId, loc(e));
      if (ptrs.size === 1) { const p = loc(e); drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, active: false }; moved = false; vel = { x: 0, y: 0 }; last = { ...p, t: performance.now() }; }
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: cam.s, bx: ((a.x + b.x) / 2 - cam.x) / cam.s, by: ((a.y + b.y) / 2 - cam.y) / cam.s };
        moved = true; for (const id of ptrs.keys()) try { view.setPointerCapture(id); } catch {}
      }
    });
    view.addEventListener("pointermove", e => {
      if (!ptrs.has(e.pointerId)) return;
      const p = loc(e); ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cam.s = clamp(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, minScale(), 2.5);
        cam.x = mx - pinch.bx * cam.s; cam.y = my - pinch.by * cam.s; drawMap.user = true; dismissHint(); apply(mx, my); return;
      }
      if (!drag) return;
      const dx = p.x - drag.sx, dy = p.y - drag.sy;
      if (!drag.active && Math.hypot(dx, dy) > (e.pointerType === "touch" ? 10 : 6)) { dismissHint(); drawMap.user = true; drag.active = moved = true; try { view.setPointerCapture(e.pointerId); } catch {} view.classList.add("panning"); hideTip(); }
      if (drag.active) {
        cam.x = drag.cx + dx; cam.y = drag.cy + dy; apply();
        const now = performance.now(), dt = Math.max(1, now - last.t);
        vel = { x: .75 * ((p.x - last.x) / dt) + .25 * vel.x, y: .75 * ((p.y - last.y) / dt) + .25 * vel.y }; last = { ...p, t: now };
      }
    });
    const end = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 1 && pinch) { pinch = null; const [p] = [...ptrs.values()]; drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, active: true }; last = { ...p, t: performance.now() }; vel = { x: 0, y: 0 }; return; }
      if (ptrs.size) return;
      pinch = null; view.classList.remove("panning");
      if (drag?.active && performance.now() - last.t < 90 && !reduced()) {
        let { x: vx, y: vy } = vel;
        const step = () => { vx *= .94; vy *= .94; cam.x += vx * 16; cam.y += vy * 16; apply(); if (Math.hypot(vx, vy) > .02) inertiaRaf = requestAnimationFrame(step); };
        inertiaRaf = requestAnimationFrame(step);
      }
      drag = null;
    };
    view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
    // a drag is not a click; when zoomed out, a click on a card flies to it
    view.addEventListener("click", e => {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; return; }
      if (!phone() && MODE === "map") { const sl = e.target.closest(".slot"); if (sl) { e.stopPropagation(); e.preventDefault(); focusIsland(sl); } }
    }, true);
    view.addEventListener("dblclick", e => {
      if (phone() || e.target.closest("[data-open],a,button,input")) return;
      getSelection()?.removeAllRanges();
      const sl = e.target.closest(".slot");
      if (sl) focusIsland(sl); else if (cam.s < ZH * .9) goHome(); else fitAll();
    });
    view.addEventListener("wheel", e => {
      if (phone()) return;
      if (e.target.closest("#sheet, #palette")) return;
      e.preventDefault(); drawMap.user = true; cancelAnimationFrame(anim); cancelAnimationFrame(inertiaRaf); tweening = false; hideTip();
      const p = loc(e);
      dismissHint();
      if (e.ctrlKey || e.metaKey) zoomAt(cam.s * Math.exp(-clamp(e.deltaY * (e.deltaMode ? 16 : 1), -40, 40) * .0085), p.x, p.y);
      else { const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? vh() : 1; cam.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k; cam.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k; apply(); }
    }, { passive: false });
    let gs = 1; // Safari trackpad pinch
    view.addEventListener("gesturestart", e => { e.preventDefault(); gs = cam.s; });
    view.addEventListener("gesturechange", e => { if (phone()) return; e.preventDefault(); const p = loc(e); drawMap.user = true; zoomAt(gs * e.scale, p.x, p.y); });
    $("#minimap").addEventListener("click", e => {
      const r = $("#minimap canvas").getBoundingClientRect(), k = $("#minimap")._k / 2;
      const bx = (e.clientX - r.left) / k, by = (e.clientY - r.top) / k;
      tween({ s: cam.s, x: vw() / 2 - bx * cam.s, y: vh() / 2 - by * cam.s });
    });
    // the zoom control: always visible, three quiet buttons
    $("#zoom").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return; drawMap.user = true;
      if (b.dataset.z === "in") zoomAt(cam.s * 1.4, vw() / 2, vh() / 2, true);
      else if (b.dataset.z === "out") zoomAt(cam.s / 1.4, vw() / 2, vh() / 2, true);
      else (cam.s < ZH * .9 ? goHome() : fitAll());
    });
  }

  // ---------------------------------------------------------------- phone: cards + map
  let tabsIdx = 0;
  function renderTabs() {
    const slots = $$(".slot", board());
    $("#tabs").innerHTML = slots.map((s, i) => `<button data-i="${i}">${esc(s.dataset.title)}</button>`).join("");
    $("#maptoggle").onclick = () => (document.body.classList.contains("overview") ? leaveMap(tabsIdx) : enterMap());
    syncTabs(true);
  }
  const step = () => { const s = $(".slot", board()); return s ? s.offsetWidth + 10 : innerWidth; };
  function syncTabs(force) {
    const i = Math.round(board().scrollLeft / step());
    if (i === tabsIdx && !force) return;
    tabsIdx = i;
    $$("#tabs button").forEach((b, j) => b.classList.toggle("on", j === i));
    const b = $$("#tabs button")[i];
    if (b) $("#tabs").scrollTo({ left: b.offsetLeft - ($("#tabs").clientWidth - b.offsetWidth) / 2, behavior: force ? "auto" : "smooth" });
  }
  function goPage(i, smooth = true) { board().scrollTo({ left: i * step(), behavior: smooth && !reduced() ? "smooth" : "auto" }); }
  function enterMap() {
    if (document.body.classList.contains("overview")) return;
    document.body.classList.add("overview");
    const sw = (innerWidth - 32 - 12) / 2; document.body.style.setProperty("--mini", (sw / (innerWidth - 32)).toFixed(4));
    board().scrollTop = 0;
    $$(".slot", board()).forEach((s, i) => s.classList.toggle("cur", i === tabsIdx));
  }
  function leaveMap(i) {
    document.body.classList.remove("overview");
    requestAnimationFrame(() => { goPage(i, false); const isl = $$(".slot", board())[i]?.firstElementChild; if (isl) { isl.classList.remove("enter"); void isl.offsetWidth; isl.classList.add("enter"); } syncTabs(true); });
  }
  function bindPhone() {
    board().addEventListener("scroll", () => { if (phone() && !document.body.classList.contains("overview")) syncTabs(); }, { passive: true });
    $("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const i = +b.dataset.i; i === tabsIdx ? enterMap() : goPage(i); });
    board().addEventListener("click", e => {
      if (!document.body.classList.contains("overview")) return;
      const s = e.target.closest(".slot"); if (!s) return;
      e.preventDefault(); e.stopPropagation(); leaveMap($$(".slot", board()).indexOf(s));
    }, true);
    let d0 = 0, fired = false;
    const dist = ts => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    $("#view").addEventListener("touchstart", e => { if (e.touches.length === 2 && phone()) { d0 = dist(e.touches); fired = false; } }, { passive: true });
    $("#view").addEventListener("touchmove", e => {
      if (e.touches.length !== 2 || !d0 || fired || !phone()) return;
      const r = dist(e.touches) / d0, ov = document.body.classList.contains("overview");
      if (!ov && r < .72) { fired = true; enterMap(); }
      else if (ov && r > 1.35) {
        fired = true;
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const el = document.elementFromPoint(mx, my)?.closest(".slot");
        leaveMap(el ? $$(".slot", board()).indexOf(el) : tabsIdx);
      }
    }, { passive: true });
    $("#view").addEventListener("touchend", e => { if (e.touches.length < 2) d0 = 0; }, { passive: true });
  }

  // reveal an entity on the board (used by search and deep links)
  function reveal(kind, id) {
    const el = $(`.board [data-open="${kind}:${CSS.escape(id)}"]`);
    if (!el) return;
    const slot = el.closest(".slot");
    if (phone()) {
      if (document.body.classList.contains("overview")) document.body.classList.remove("overview");
      goPage($$(".slot", board()).indexOf(slot), false); syncTabs(true);
      const isl = slot.firstElementChild; isl.scrollTo({ top: Math.max(0, el.offsetTop - 120) });
    } else {
      const c = el.closest(".collapse"); if (c && !c.classList.contains("open")) { c.classList.add("open"); relayoutSoon(); }
      setTimeout(() => focusEl(el), 40);
    }
    el.classList.remove("hl"); void el.offsetWidth; el.classList.add("hl");
  }

  // ---------------------------------------------------------------- command palette
  function paletteItems() {
    return [
      ...D.atlas.people.map(p => ({ k: "person", id: p.id, label: p.name, sub: tx(p.role), hay: `${p.name} ${(p.aliases || []).join(" ")} ${p.role.ru} ${p.role.en} ${zoneLabel(p.zone)} ${tx(p.bio)}`, pic: p.kind === "group" ? icon(p) : avatar(p) })),
      ...D.atlas.products.map(p => ({ k: "product", id: p.id, label: p.name, sub: clusterLabel(p.cluster), hay: `${p.name} ${p.name.replace(/Claude/g, "Клод")} ${tx(p.description)} ${(p.children || []).map(c => c.name + " " + (c.apiId || "")).join(" ")}`, pic: icon(p) })),
      ...D.atlas.facts.map(f => ({ k: "fact", id: f.id, label: tx(f.label), sub: f.value, hay: `${f.label.ru || ""} ${f.label.en || ""} ${f.value}`, pic: "" })),
      ...D.terms.map(g => ({ k: "term", id: g.id, label: g.term, sub: tx(g.definition).slice(0, 60) + "…", hay: `${g.term} ${(g.aliases || []).join(" ")}`, pic: "" })),
      ...D.events.map(e => ({ k: "event", id: e.id, label: tx(e.title), sub: fmtDate(e.date), hay: `${e.title.ru} ${e.title.en} ${tx(e.summary)}`, pic: "" })),
      ...(LIB ? LIB.sections.map(s => ({ k: "shelf", id: s.id, label: tx(s), sub: L("shelves"), hay: `${s.ru} ${s.en} ${L("shelves")}`, pic: "" })) : []),
      ...(LIB ? LIB.items.map(i => ({ k: "lib", id: i.id, label: libT(i), sub: `${secName(i.section)} · ${host2(i.url)}`, hay: `${libT(i)} ${i.title} ${libS(i)} ${i.desc || ""} ${i.group || ""}`, pic: "" })) : [])
    ];
  }
  const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
  // one spelling for search: lower case, no accents, Cyrillic written in Latin letters, look-alike letters folded
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[а-яё]/g, c => TR[c] ?? c)
    .replace(/kh/g, "h").replace(/ck/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/w/g, "v").replace(/x/g, "ks").replace(/q/g, "k").replace(/j/g, "dzh").replace(/ph/g, "f").replace(/(.)\1+/g, "$1").replace(/[^a-z0-9 ]+/g, " ");
  const BASE = { person: 0, product: .1, shelf: .2, term: .3, fact: .35, event: .6, lib: .8 };
  let PI = null, sel = 0, results = [];
  function openPalette() { PI ??= paletteItems().map(it => ({ ...it, hayN: " " + norm(it.label + " " + it.hay) + " ", labelN: norm(it.label) })); $("#palette").classList.add("on"); $("#pscrim").classList.add("on"); const i = $("#palette input"); i.placeholder = t("search"); i.value = ""; search(""); i.focus(); }
  function closePalette() { $("#palette").classList.remove("on"); $("#pscrim").classList.remove("on"); $("#palette input").blur(); }
  function search(q) {
    const ws = norm(q).split(/\s+/).filter(Boolean);
    if (!ws.length) results = PI.filter(i => i.k !== "event" && i.k !== "lib").slice(0, 10);
    else {
      const scored = [];
      for (const it of PI) {
        let sc = BASE[it.k] ?? 1, ok = true;
        for (const w of ws) {
          if (it.labelN.startsWith(w)) sc += 0;
          else if (it.labelN.includes(" " + w)) sc += .4;
          else if (it.hayN.includes(" " + w)) sc += 1;
          else if (w.length > 3 && it.hayN.includes(w)) sc += 1.6;
          else { ok = false; break; }
        }
        if (ok) scored.push([it, sc]);
      }
      scored.sort((a, b) => a[1] - b[1]);
      let libN = 0; const seen = new Set();
      results = scored.map(x => x[0]).filter(it => { const key = it.k + it.labelN; if (seen.has(key)) return false; seen.add(key); return it.k !== "lib" || ++libN <= 25; }).slice(0, 40);
    }
    sel = 0; drawResults();
  }
  function drawResults() {
    const ul = $("#palette ul");
    ul.innerHTML = results.length ? results.map((r, i) => `<li class="${i === sel ? "sel" : ""}" data-i="${i}">${r.pic}<span>${esc(r.label)}</span><small>${esc(r.sub)}</small></li>`).join("") : `<div class="empty">${esc(t("nothing"))}</div>`;
    ul.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  }
  function choose(i) { const r = results[i]; if (!r) return; closePalette(); S.stack = []; openEntity(r.k, r.id); setTimeout(() => reveal(r.k, r.id), 60); }

  // ---------------------------------------------------------------- page
  function renderBar() {
    const dg = S.latest, el = $("#stamp");
    $("#lang").textContent = S.lang.toUpperCase();
    $("#find-lbl").textContent = t("find");
    if (!dg) { el.innerHTML = `${esc(t("updated"))} ${esc(fmtDate(D.atlas.meta.updatedAt))}`; return; }
    const when = new Date(dg.generatedAt), days = Math.floor((Date.now() - when) / 864e5);
    const day = days < 1 && new Date().toDateString() === when.toDateString() ? t("today") : days < 2 ? t("yesterday") : when.toLocaleDateString(locale(), { day: "numeric", month: "long" });
    el.innerHTML = `${esc(t("updated"))} <b>${esc(day)} ${esc(t("at"))} ${when.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}</b> · <a href="${METHOD_URL}" target="_blank" rel="noopener">${esc(t("method"))}</a>`;
  }
  function renderAll({ keepCamera = false } = {}) {
    AN_CACHE = null; PI = null;
    board().classList.toggle("far", MODE === "map");
    renderBar();
    const keepPage = tabsIdx;
    board().innerHTML = "";
    if (!phone()) board().insertAdjacentHTML("afterbegin", `<svg class="wires" id="links"></svg><svg class="wires top" id="links-top"></svg><section class="hero" aria-label="Today">${heroHTML()}</section>`);
    for (const m of D.modules) if (!m.hidden && R[m.renderer]) try { R[m.renderer](m); } catch (err) { console.warn(m.id, err); }
    document.documentElement.lang = S.lang;
    $$("img", board()).forEach(img => img.addEventListener("load", relayoutSoon, { once: true }));
    if (phone()) { renderTabs(); if (keepCamera) goPage(keepPage, false); }
    else { layout(); if (!keepCamera) startCamera(); else apply(); if (!keepCamera && !reduced()) { $$(".slot", board()).forEach((s, i) => s.style.setProperty("--i", Math.min(i, 12))); board().classList.add("intro"); setTimeout(() => board().classList.remove("intro"), 1600); } }
  }
  function dismissHint() { clearTimeout(dismissHint.t); $("#hint")?.classList.remove("on"); }
  function startCamera() {
    let first = false; try { first = !sessionStorage.getItem("atlas.intro"); sessionStorage.setItem("atlas.intro", "1"); } catch {}
    // the first visit opens on the whole space for a moment, then settles on the page: it shows that the space exists
    if (first && !reduced() && !location.hash) { fitAll(false); setTimeout(() => goHome(), 900); } else goHome(false);
    if (!store.get("atlas.hint")) { const h = $("#hint"); h.textContent = t(matchMedia("(pointer: coarse)").matches ? "hintT" : "hint"); dismissHint.t = setTimeout(() => h.classList.add("on"), 2200); setTimeout(dismissHint, 6500); store.set("atlas.hint", "1"); }
  }

  // ---------------------------------------------------------------- events
  function bind() {
    document.addEventListener("click", e => {
      const o = e.target.closest("[data-open]");
      if (o) {
        e.preventDefault(); const [k, ...rest] = o.dataset.open.split(":"); if (!o.closest("#sheet")) S.stack = []; openEntity(k, rest.join(":")); hideTip();
        if (!phone() && o.closest("#board")) { const r = o.getBoundingClientRect(), edge = innerWidth - sheetW(); if (r.right > edge - 16) tween({ s: cam.s, x: cam.x - (r.right - edge + 40), y: cam.y }, 420); }
        return;
      }
      const g = e.target.closest("abbr.g");
      if (g) { e.preventDefault(); e.stopPropagation(); if (!g.closest("#sheet")) S.stack = []; hideTip(); openEntity("term", g.dataset.term); return; }
      const more = e.target.closest(".more[aria-expanded]");
      if (more) { const c = more.nextElementSibling; const open = !c.classList.contains("open"); c.classList.toggle("open", open); more.setAttribute("aria-expanded", open); relayoutSoon(); return; }
      const cr = e.target.closest("[data-crumb]");
      const dd = e.target.closest("[data-d]");
      if (dd) { getJSON(`/data/digests/${dd.dataset.d}.json`).then(x => { if (!(x = normDigest(x))) return; S.digest = x; renderAll({ keepCamera: true }); }).catch(() => {}); return; }
      const j = e.target.closest("[data-jump]");
      if (j) { const sl = $(`.slot[data-island="${j.dataset.jump}"]`); if (sl) focusIsland(sl); return; }
      if (cr) { S.stack = S.stack.slice(0, +cr.dataset.crumb + 1); const s = S.stack.at(-1); openEntity(s.kind, s.id, { push: false }); return; }
      if (e.target.closest("[data-copy]")) navigator.clipboard?.writeText(location.href).then(() => toast(t("copied"))).catch(() => {});
    });
    document.addEventListener("mouseover", e => {
      if (phone() || $("#view").classList.contains("panning")) return;
      const r = e.target.closest(".slot [data-open^='person:']"), id = r ? r.dataset.open.slice(7) : null;
      if (id !== S.hover) { S.hover = id; drawLinks(); }
    });
    document.addEventListener("mouseover", e => { const g = e.target.closest("abbr.g"); if (g) { const term = IDX.get(`term:${g.dataset.term}`); if (term) showTip(g, term.term, tx(term.definition)); } });
    document.addEventListener("mouseout", e => { if (e.target.closest("abbr.g")) hideTip(); });
    $("#sheet-body").addEventListener("input", e => { if (e.target.matches(".sf")) { SH.q = e.target.value; SH.lim = 60; fillShelf(); } });
    $("#sheet-body").addEventListener("click", e => {
      const a = e.target.closest("[data-aud]"); if (a) { SH.aud = a.dataset.aud; SH.lim = 60; $$("[data-aud]", $("#sheet-body")).forEach(b => b.setAttribute("aria-pressed", b === a)); fillShelf(); return; }
      if (e.target.closest("[data-lim]")) { SH.lim += 60; fillShelf(); }
    });
    $("#scrim").addEventListener("click", closeSheet);
    $("#x").addEventListener("click", closeSheet);
    $("#pscrim").addEventListener("click", closePalette);
    $("#open-search").addEventListener("click", openPalette);
    $("#lang").addEventListener("click", cycleLang);
    const input = $("#palette input");
    let st = 0; input.addEventListener("input", () => { clearTimeout(st); st = setTimeout(() => search(input.value), PI && PI.length > 800 ? 70 : 0); });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); drawResults(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); drawResults(); }
      else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
      else if (e.key === "Escape") closePalette();
    });
    $("#palette ul").addEventListener("click", e => { const li = e.target.closest("li"); if (li) choose(+li.dataset.i); });
    $("#palette ul").addEventListener("mousemove", e => { const li = e.target.closest("li"); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; $$("#palette li").forEach((x, i) => x.classList.toggle("sel", i === sel)); } });
    document.addEventListener("keydown", e => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").classList.contains("on") ? closePalette() : openPalette(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const sheetOn = $("#sheet").classList.contains("on");
      if (e.key === "/") { e.preventDefault(); openPalette(); }
      else if (e.key === "Escape") { if (sheetOn) back(); else if (document.body.classList.contains("overview")) leaveMap(tabsIdx); }
      else if (e.key === "Backspace" && sheetOn) { e.preventDefault(); back(); }
      else if (e.key.toLowerCase() === "l") cycleLang();
      else if (!phone() && e.key === "0") { drawMap.user = true; fitAll(); }
      else if (!phone() && e.key === "1") goHome();
      else if (!phone() && (e.key === "+" || e.key === "=")) zoomAt(cam.s * 1.3, vw() / 2, vh() / 2, true);
      else if (!phone() && (e.key === "-" || e.key === "_")) zoomAt(cam.s / 1.3, vw() / 2, vh() / 2, true);
      else if (!phone() && e.key.startsWith("Arrow") && !sheetOn) { e.preventDefault(); const d = 160; tween({ s: cam.s, x: cam.x + (e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0), y: cam.y + (e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0) }, 240); }
      else if (!phone() && (e.key === " " || e.key === "PageDown" || e.key === "PageUp") && !sheetOn) { e.preventDefault(); tween({ s: cam.s, x: cam.x, y: cam.y + (e.key === "PageUp" || e.shiftKey ? 1 : -1) * vh() * .85 }, 380); }
    });
    addEventListener("hashchange", fromHash);
    let wasPhone = phone();
    addEventListener("resize", () => { const p = phone(); if (p !== wasPhone) { wasPhone = p; document.body.classList.remove("overview"); renderAll(); } else if (!p) { layout(); apply(); } });
    // swipe the sheet away (down on phones, right elsewhere)
    const sh = $("#sheet"); let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
    sh.addEventListener("touchstart", e => { if ($("#sheet-body").scrollTop > 0 && phone()) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dragging = true; dx = dy = 0; }, { passive: true });
    sh.addEventListener("touchmove", e => { if (!dragging) return; dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy; const d = phone() ? Math.max(0, dy) : Math.max(0, dx); if (d > 6) { sh.style.transition = "none"; sh.style.transform = phone() ? `translateY(${d}px)` : `translateX(${d}px)`; } }, { passive: true });
    sh.addEventListener("touchend", () => { if (!dragging) return; dragging = false; sh.style.transition = ""; sh.style.transform = ""; if ((phone() ? dy : dx) > 90) closeSheet(); });
  }
  function cycleLang() {
    S.lang = LANGS[(LANGS.indexOf(S.lang) + 1) % LANGS.length]; store.set("atlas.lang", S.lang);
    const st = S.stack.slice(); renderAll({ keepCamera: true });
    if (st.length) { S.stack = st; const s = st.at(-1); openEntity(s.kind, s.id, { push: false }); }
  }
  function fromHash() {
    const m = location.hash.match(/^#\/(person|product|event|term|fact|lib|shelf)\/(.+)$/);
    if (!m) return;
    let id = m[2]; try { id = decodeURIComponent(id); } catch {}
    if (!IDX.has(`${m[1]}:${id}`)) { if (LIB || !/^(lib|shelf)$/.test(m[1])) toast(M("gone")); return; }
    S.stack = []; openEntity(m[1], id, { fromHash: true }); setTimeout(() => reveal(m[1], id), 120);
  }

  // ---------------------------------------------------------------- boot
  const qlang = new URLSearchParams(location.search).get("lang"); if (LANGS.includes(qlang)) { S.lang = qlang; store.set("atlas.lang", qlang); }
  // a broken avatar falls back to initials (no inline handlers, so the page can run under a strict CSP)
  document.addEventListener("error", e => { if (e.target.tagName === "IMG" && e.target.closest(".av")) e.target.remove(); }, true);
  // The library is part of the first screen: wait for it briefly, never longer than 2.5 s.
  load().then(async () => {
    buildGloss(); bind(); bindCanvas(); bindPhone();
    const lib = loadLibrary().then(() => true, e => { console.warn("library", e); return false; });
    const early = await Promise.race([lib, new Promise(r => setTimeout(() => r(null), 2500))]);
    try { renderAll(); fromHash(); } finally { $("#loading")?.remove(); }
    if (early === null) lib.then(ok => { if (!ok) return; const st = S.stack.slice(); renderAll({ keepCamera: true }); if (st.length) { S.stack = st; const s = st.at(-1); openEntity(s.kind, s.id, { push: false, fromHash: true }); } else fromHash(); });
    document.fonts?.ready.then(() => !phone() && layout());
  }).catch(err => { const l = $("#loading"); if (l) l.textContent = `${{ ru: "Не удалось загрузить данные.", en: "Could not load the data.", uz: "Ma’lumotlarni yuklab bo‘lmadi." }[S.lang]} ${err.message}`; console.error(err); });
  window.ATLAS = { get data() { return D; }, openEntity, cam, fitAll, goHome };
})();

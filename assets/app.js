/* Anthropic Atlas — renderer. Data lives in /data/*.json (see docs/METHODOLOGY.md). No build step.
   The page is a spatial board: every module from data/modules.json renders one or more "islands".
   Desktop/tablet: islands are packed into columns on a pannable, zoomable canvas.
   Phone: the same islands become swipeable cards; pinch in (or tap the active tab) for the map of all islands.
   Every entity, at any depth, opens in the same sheet template. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- i18n
  const UI = {
    ru: { updated: "Обновлено", today: "сегодня", yesterday: "вчера", at: "в", news: "новости", added: "добавлено", updatedN: "изменено", removed: "убрано", find: "Поиск", search: "Люди, продукты, события, термины", nothing: "Ничего не найдено", former: "Бывшие", trust: "Траст LTBT", board: "Совет директоров", votes: "Голоса акционеров", status: "Статус", since: "В компании с", until: "До", zone: "Направление", released: "Выпуск", metrics: "Ключевое", owners: "Ответственные", children: "Состав", related: "Связи", events: "События", sources: "Источники", verified: "Проверено", wikipedia: "Википедия", official: "Официально", docs: "Документация", wikidata: "Wikidata", github: "GitHub", site: "Сайт", linkedin: "LinkedIn", x: "X", reports: "Подчиняется", manages: "Руководит", oversees: "Под надзором", oversightBy: "Надзор: совет или траст", products: "Продукты", active: "работает", preview: "превью", legacy: "предыдущее", retired: "выведен", deprecated: "устарел", formerS: "бывший сотрудник", activeP: "в компании", copied: "Ссылка скопирована", asOf: "На дату", digestFor: "Сводка за", aliases: "Также", seeAlso: "Где встречается", newBadge: "новое", earlier: "Ранее", showAll: "Показать все", hint: "Перетаскивайте доску · двойной щелчок приближает · 0 показывает всё", noDigest: "Сводки пока нет", footer: "Открытые источники, обновление каждое утро", method: "Методология", repo: "GitHub", types: { model: "Модели", product: "Продукты", people: "Люди", governance: "Управление", finance: "Финансы", policy: "Политика", research: "Исследования", safety: "Безопасность", partnership: "Партнёрства", legal: "Право", infrastructure: "Платформа" } },
    en: { updated: "Updated", today: "today", yesterday: "yesterday", at: "at", news: "news", added: "added", updatedN: "updated", removed: "removed", find: "Search", search: "People, products, events, terms", nothing: "Nothing found", former: "Former", trust: "Long-Term Benefit Trust", board: "Board of directors", votes: "Shareholder votes", status: "Status", since: "Since", until: "Until", zone: "Area", released: "Released", metrics: "Key figure", owners: "Owners", children: "Includes", related: "Connections", events: "Events", sources: "Sources", verified: "Verified", wikipedia: "Wikipedia", official: "Official", docs: "Docs", wikidata: "Wikidata", github: "GitHub", site: "Website", linkedin: "LinkedIn", x: "X", reports: "Reports to", manages: "Manages", oversees: "Oversight of", oversightBy: "Oversight: board or trust", products: "Products", active: "active", preview: "preview", legacy: "previous", retired: "retired", deprecated: "deprecated", formerS: "former", activeP: "current", copied: "Link copied", asOf: "As of", digestFor: "Digest for", aliases: "Also", seeAlso: "Mentioned in", newBadge: "new", earlier: "Earlier", showAll: "Show all", hint: "Drag to move · double-click to zoom · 0 shows everything", noDigest: "No digest yet", footer: "Public sources, refreshed every morning", method: "Methodology", repo: "GitHub", types: { model: "Models", product: "Products", people: "People", governance: "Governance", finance: "Finance", policy: "Policy", research: "Research", safety: "Safety", partnership: "Partnerships", legal: "Legal", infrastructure: "Platform" } },
    uz: { updated: "Yangilandi", today: "bugun", yesterday: "kecha", at: "soat", news: "yangilik", added: "qo'shildi", updatedN: "o'zgardi", removed: "olib tashlandi", find: "Qidiruv", search: "Odamlar, mahsulotlar, voqealar, atamalar", nothing: "Hech narsa topilmadi", former: "Sobiq", trust: "LTBT trasti", board: "Direktorlar kengashi", votes: "Aksiyadorlar ovozi", status: "Holat", since: "Kompaniyada", until: "Gacha", zone: "Yo'nalish", released: "Chiqarilgan", metrics: "Asosiy", owners: "Mas'ullar", children: "Tarkib", related: "Aloqalar", events: "Voqealar", sources: "Manbalar", verified: "Tekshirilgan", wikipedia: "Vikipediya", official: "Rasmiy", docs: "Hujjatlar", wikidata: "Wikidata", github: "GitHub", site: "Sayt", linkedin: "LinkedIn", x: "X", reports: "Bo'ysunadi", manages: "Boshqaradi", oversees: "Nazorat qiladi", oversightBy: "Nazorat: kengash yoki trast", products: "Mahsulotlar", active: "faol", preview: "sinov", legacy: "oldingi", retired: "to'xtatilgan", deprecated: "eskirgan", formerS: "sobiq", activeP: "kompaniyada", copied: "Havola nusxalandi", asOf: "Sana", digestFor: "Xulosa", aliases: "Shuningdek", seeAlso: "Qayerda uchraydi", newBadge: "yangi", earlier: "Avvalroq", showAll: "Hammasini ko'rsatish", hint: "Doskani suring · ikki marta bosish yaqinlashtiradi · 0 hammasini ko'rsatadi", noDigest: "Xulosa hali yo'q", footer: "Ochiq manbalar, har kuni ertalab", method: "Metodologiya", repo: "GitHub", types: { model: "Modellar", product: "Mahsulotlar", people: "Odamlar", governance: "Boshqaruv", finance: "Moliya", policy: "Siyosat", research: "Tadqiqot", safety: "Xavfsizlik", partnership: "Hamkorlik", legal: "Huquq", infrastructure: "Platforma" } }
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
  function fmtDate(d, opts = { day: "numeric", month: "long", year: "numeric" }) {
    if (!d) return "";
    if (/^\d{4}$/.test(d)) return d;
    if (/^\d{4}-\d{2}$/.test(d)) return new Date(d + "-01T12:00:00Z").toLocaleDateString(locale(), { month: "long", year: "numeric" });
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + "T12:00:00Z").toLocaleDateString(locale(), opts);
    return d;
  }
  const initials = p => esc(p.initials || p.name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase());
  function avatar(p, cls = "") {
    const img = p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : "";
    return `<span class="av ${cls}">${initials(p)}${img}</span>`;
  }
  const glyph = name => esc((name.replace(/^Claude\s+/, "").replace(/[^\p{L}\p{N}]/gu, "") || "··").slice(0, 2));
  const icon = (p, cls = "") => `<span class="av sq ${cls}">${glyph(p.name)}</span>`;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 1600); }

  // ---------------------------------------------------------------- data
  let D;
  const IDX = new Map(); // "kind:id" -> entity
  async function getJSON(path) { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
  async function load() {
    const [atlas, events, glossary, modules, digests] = await Promise.all(["/data/atlas.json", "/data/events.json", "/data/glossary.json", "/data/modules.json", "/data/digests/index.json"].map(p => getJSON(p).catch(() => null)));
    if (!atlas) throw new Error("atlas.json");
    D = { atlas, events: events?.events || [], terms: glossary?.terms || [], modules: modules?.modules || [], digests: digests?.digests || [] };
    for (const p of atlas.people) IDX.set(`person:${p.id}`, { ...p, kind: p.kind === "group" ? "group" : "person", isPerson: true });
    for (const p of atlas.products) IDX.set(`product:${p.id}`, { kind: "product", ...p });
    for (const e of D.events) IDX.set(`event:${e.id}`, { kind: "event", ...e });
    for (const g of D.terms) IDX.set(`term:${g.id}`, { kind: "term", ...g });
    for (const f of atlas.facts) IDX.set(`fact:${f.id}`, { kind: "fact", ...f });
    if (D.digests[0]) S.digest = await getJSON(`/data/digests/${D.digests[0].date}.json`).catch(() => null);
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
  function island(id, title, { count = "", lead = "", cls = "" } = {}, body = "") {
    const slot = document.createElement("div");
    slot.className = "slot"; slot.dataset.island = id;
    slot.innerHTML = `<section class="island ${cls}" id="i-${esc(id)}" aria-label="${esc(title)}" data-title="${esc(title)}"><header class="ih"><h2>${esc(title)}</h2><span class="ic num">${esc(count)}</span></header>${lead ? `<p class="lead-txt">${gloss(lead)}</p>` : ""}<div class="ib">${body}</div></section>`;
    board().appendChild(slot);
    return slot.firstElementChild;
  }
  const row = (p, side) => `<button class="row ${p.status === "former" ? "former" : ""}" data-open="person:${p.id}">${p.kind === "group" ? icon(p) : avatar(p)}<span class="who"><span class="nm">${esc(p.name)}</span><span class="rl">${esc(tx(p.role))}</span></span>${side !== undefined ? `<span class="side num">${esc(side)}</span>` : ""}</button>`;
  const collapsible = (label, inner) => `<button class="more" aria-expanded="false">${esc(label)}</button><div class="collapse"><div>${inner}</div></div>`;

  const R = {};

  R.digest = m => {
    const dg = S.digest;
    if (!dg) { island(m.id, tx(m.title), {}, `<p class="lead-txt">${esc(t("noDigest"))}</p>`); return; }
    const newsEv = dg.news.map(id => IDX.get(`event:${id}`)).filter(Boolean);
    const groups = [
      ["news", newsEv.map(e => ({ sign: "", text: tx(e.title), ref: `event:${e.id}` }))],
      ["added", dg.added.map(a => ({ sign: "+", text: a.label, ref: `${a.kind}:${a.id}` }))],
      ["updatedN", dg.updated.map(a => ({ sign: "", text: a.label, why: a.reason || (a.fields || []).join(", "), ref: `${a.kind}:${a.id}` }))],
      ["removed", dg.removed.map(a => ({ sign: "−", text: a.label, why: a.reason, ref: `${a.kind}:${a.id}` }))]
    ];
    const past = D.digests.slice(0, 7);
    const el = island(m.id, tx(m.title), { cls: "today" }, `
      <div class="date">${esc(t("digestFor"))} ${esc(fmtDate(dg.date))}</div>
      <h1>${esc(tx(dg.headline))}</h1>
      <p class="summary">${gloss(tx(dg.summary))}</p>
      <div class="counts">${groups.map(([k, items]) => `<button data-g="${k}" ${items.length ? "" : "disabled"} aria-expanded="false"><b class="num">${items.length}</b><span>${esc(t(k))}</span></button>`).join("")}</div>
      <div class="collapse dg"><div><ul class="dl"></ul></div></div>
      ${past.length > 1 ? `<div class="past"><span>${esc(t("earlier"))}:</span>${past.map(h => `<button data-d="${h.date}" class="${h.date === dg.date ? "on" : ""}">${esc(fmtDate(h.date, { day: "numeric", month: "short" }))}</button>`).join("")}</div>` : ""}`);
    const panel = $(".dg", el), list = $(".dl", el);
    $$(".counts button", el).forEach(b => b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") === "true";
      $$(".counts button", el).forEach(x => x.setAttribute("aria-expanded", "false"));
      if (open) { panel.classList.remove("open"); relayoutSoon(); return; }
      b.setAttribute("aria-expanded", "true");
      list.innerHTML = groups.find(g => g[0] === b.dataset.g)[1].map(i => `<li><span class="sign">${i.sign}</span><span><a href="#" data-open="${esc(i.ref)}">${esc(i.text)}</a>${i.why ? ` <span class="why">— ${esc(i.why)}</span>` : ""}</span></li>`).join("");
      panel.classList.add("open"); relayoutSoon();
    }));
    $$(".past button", el).forEach(b => b.addEventListener("click", async () => { S.digest = await getJSON(`/data/digests/${b.dataset.d}.json`); renderAll(); }));
  };

  R.facts = m => {
    island(m.id, tx(m.title), {}, `<div class="facts">${D.atlas.facts.map(f => `<button class="fact" data-open="fact:${f.id}"><span class="v num">${esc(f.value)}</span><span class="k">${esc(tx(f.label))}</span></button>`).join("")}</div>`);
  };

  R.timeline = m => {
    const latest = S.digest?.date;
    const evs = S.allEvents ? D.events : D.events.slice(0, 16);
    const days = [];
    for (const e of evs) { const last = days.at(-1); if (last && last.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] }); }
    const thisYear = String(new Date().getFullYear());
    const el = island(m.id, tx(m.title), { count: String(D.events.length), lead: tx(m.lead) }, days.map(d => `<div class="day-h num">${esc(fmtDate(d.date, { day: "numeric", month: "long", year: d.date.slice(0, 4) === thisYear ? undefined : "numeric" }))}</div>${d.items.map(e => `
      <button class="ev" data-open="event:${e.id}" data-imp="${e.importance}"><span class="t">${esc(tx(e.title))}</span><span class="m">${esc(t("types")[e.type] || e.type)} · ${esc(e.sources[0].title)}${e.addedAt === latest ? ` · <span class="new">${esc(t("newBadge"))}</span>` : ""}</span></button>`).join("")}`).join("") + (S.allEvents ? "" : `<button class="more" data-all>${esc(t("showAll"))} · ${D.events.length}</button>`));
    $("[data-all]", el)?.addEventListener("click", () => { S.allEvents = true; renderAll({ keepCamera: true }); });
  };

  const isBoard = p => /Board|Director|Chair of the Board/i.test(p.role.en || "") && p.status === "active";
  const isTrustee = p => p.zone === "ltbt" && /Trust/i.test(p.role.en || "") && p.status === "active";

  R.governance = m => {
    const people = D.atlas.people;
    const fVotes = parseFloat((D.atlas.facts.find(f => f.id === "class_f_votes") || {}).value) || 0;
    const trustees = people.filter(isTrustee), boardP = people.filter(isBoard).sort((a, b) => b.influence - a.influence);
    const former = people.filter(p => ["ltbt", "capital"].includes(p.zone) && p.status === "former" && /Trust|Board|Director/i.test(p.role.en));
    const el = island(m.id, tx(m.title), { lead: tx(m.lead) }, `
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
      island(`zone-${z.id}`, tx(z.label), { count: String(act.length) }, act.map(p => row(p)).join("") + (fm.length ? collapsible(`${t("former")} · ${fm.length}`, fm.map(p => row(p, (p.until || "").slice(0, 4))).join("")) : ""));
    }
  };

  const order = { active: 0, preview: 1, legacy: 2, deprecated: 3, retired: 4 };
  R.products = () => {
    for (const c of D.atlas.clusters) {
      const ps = D.atlas.products.filter(p => p.cluster === c.id).sort((a, b) => order[a.status] - order[b.status] || String(b.released).localeCompare(String(a.released)));
      if (!ps.length) continue;
      island(`cluster-${c.id}`, tx(c.label), { count: String(ps.length) }, ps.map(p => `<button class="row" data-open="product:${p.id}">${icon(p)}<span class="who"><span class="nm">${esc(p.name)}</span><span class="rl">${esc(tx(p.description))}</span></span><span class="side">${p.status === "active" ? esc(String(p.released || "").slice(0, 4)) : `<span class="st ${p.status}">${esc(t(p.status))}</span>`}</span></button>`).join(""));
    }
  };

  R.glossary = m => {
    const cats = { governance: 1, finance: 2, safety: 3, models: 4, platform: 5, product: 6 };
    island(m.id, tx(m.title), { count: String(D.terms.length), lead: tx(m.lead) }, [...D.terms].sort((a, b) => (cats[a.category] || 9) - (cats[b.category] || 9)).map(g => `<button class="term" data-open="term:${g.id}"><b>${esc(g.term)}</b><span>${esc(tx(g.definition))}</span></button>`).join(""));
  };

  R.cards = m => { // generic renderer for new topics: any array of {id,name,description,sources}
    const el = island(m.id, tx(m.title), { lead: tx(m.lead) }, "");
    const [file, key] = (m.source || "").split("#");
    getJSON(`/data/${file}`).then(d => {
      const items = d[key] || [];
      for (const it of items) IDX.set(`product:${it.id}`, { kind: "product", status: "active", ...it });
      $(".ib", el).innerHTML = items.map(p => `<button class="row" data-open="product:${p.id}">${icon(p)}<span class="who"><span class="nm">${esc(p.name)}</span><span class="rl">${esc(tx(p.description))}</span></span></button>`).join("");
      $(".ih .ic", el).textContent = items.length; relayoutSoon();
    }).catch(() => el.parentElement.remove());
  };

  // ---------------------------------------------------------------- sheet (one template for every entity kind)
  function linksHTML(links) {
    if (!links) return "";
    const ks = ["wikipedia", "official", "docs", "github", "site", "linkedin", "x", "wikidata"].filter(k => links[k]);
    return ks.length ? `<div class="links">${ks.map(k => `<a href="${esc(links[k])}" target="_blank" rel="noopener">${esc(t(k))}</a>`).join("")}</div>` : "";
  }
  function sourcesHTML(e) {
    if (!e.sources?.length) return "";
    return `<div class="blk"><h4>${esc(t("sources"))}</h4><div class="sources">${e.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join("")}</div>${e.verifiedAt ? `<div class="verified">${esc(t("verified"))} ${esc(fmtDate(e.verifiedAt))}</div>` : ""}</div>`;
  }
  const relEvents = (id, name) => D.events.filter(e => (e.entities || []).includes(id) || (name && name.length > 5 && (tx(e.title) + " " + e.title.en).includes(name))).slice(0, 8);
  const eventsHTML = evs => (evs.length ? `<div class="blk"><h4>${esc(t("events"))}</h4>${evs.map(e => `<button class="ev" data-open="event:${e.id}"><span class="t">${esc(tx(e.title))}</span><span class="m">${esc(fmtDate(e.date))}</span></button>`).join("")}</div>` : "");
  const kv = pairs => { const p = pairs.filter(([, v]) => v); return p.length ? `<dl class="kv">${p.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""; };
  function relRow(x, sub) {
    return `<button class="row" data-open="${ref(x)}:${x.id}">${picOf(x)}<span class="who"><span class="nm">${esc(x.name || x.term || tx(x.title))}</span><span class="rl">${esc(sub || "")}</span></span><span class="chev">›</span></button>`;
  }

  const SHEET = {
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
      return `<div class="hd">${icon(p, "lg")}<div><h3 data-copy>${esc(p.name)}</h3><div class="sub">${esc(clusterLabel(p.cluster))}${p.status !== "active" ? ` · <span class="st ${p.status}">${esc(t(p.status))}</span>` : ""}</div></div></div>
        <p class="lead">${gloss(tx(p.description))}</p>${linksHTML(p.links)}
        ${kv([[t("released"), esc(fmtDate(p.released))], [t("metrics"), p.metrics ? gloss(p.metrics) : ""]])}
        ${p.children?.length ? `<div class="blk"><h4>${esc(t("children"))}</h4>${p.children.map(c => `<div class="child"><span>${c.docs ? `<a href="${esc(c.docs)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}${c.apiId ? `<br><code>${esc(c.apiId)}</code>` : ""}${c.note ? `<br><span class="cap">${esc(tx(c.note))}</span>` : ""}</span><span class="r">${c.status && c.status !== "active" ? `<span class="st ${c.status}">${esc(t(c.status))}</span><br>` : ""}${esc(fmtDate(c.released, { day: "numeric", month: "short", year: "numeric" }))}</span></div>`).join("")}</div>` : ""}
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
    $("#sheet-body").innerHTML = SHEET[kind](e);
    $("#sheet-body").scrollTop = 0;
    const name = x => x.name || x.term || tx(x.title) || tx(x.label);
    const tail = S.stack.slice(-3);
    $("#crumbs").innerHTML = tail.length > 1 ? tail.slice(0, -1).map((s, i) => `<button data-crumb="${S.stack.length - tail.length + i}">${esc(name(IDX.get(`${s.kind}:${s.id}`)))}</button><i>›</i>`).join("") : "";
    $("#sheet").classList.add("on"); $("#scrim").classList.add("on");
    if (!fromHash) try { history.replaceState(null, "", `#/${kind}/${id}`); } catch {}
  }
  function closeSheet() {
    $("#sheet").classList.remove("on"); $("#scrim").classList.remove("on"); S.stack = [];
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

  // ---------------------------------------------------------------- desktop camera
  const COL = 360, GAP = 28, PAD = 48;
  const cam = { x: 0, y: 0, s: 1 };
  let BW = 0, BH = 0, boxes = [], anim = 0, inertiaRaf = 0;
  const vw = () => $("#view").clientWidth, vh = () => $("#view").clientHeight;

  function layout() {
    if (phone()) { board().style.width = board().style.height = ""; return; }
    const slots = $$(".slot", board());
    const hs = slots.map(s => s.offsetHeight);
    let best = null;
    for (let n = 3; n <= 8; n++) {
      const cols = new Array(n).fill(0), pos = [];
      hs.forEach(h => { const c = cols.indexOf(Math.min(...cols)); pos.push([c, cols[c]]); cols[c] += h + GAP; });
      const W = n * COL + (n - 1) * GAP + PAD * 2, H = Math.max(...cols) - GAP + PAD * 2;
      const score = Math.abs(Math.log((W / H) / 1.9));
      if (!best || score < best.score) best = { n, pos, W, H, score };
    }
    boxes = slots.map((s, i) => { const [c, y] = best.pos[i]; const x = PAD + c * (COL + GAP); s.style.left = x + "px"; s.style.top = PAD + y + "px"; return { el: s, x, y: PAD + y, w: COL, h: hs[i] }; });
    BW = best.W; BH = best.H;
    board().style.width = BW + "px"; board().style.height = BH + "px";
    drawMap();
  }
  let relayoutT = 0;
  function relayoutSoon() { clearTimeout(relayoutT); relayoutT = setTimeout(layout, 480); }

  function apply() {
    if (phone()) return;
    const v = { w: vw(), h: vh() };
    const m = 160; // keep part of the board on screen
    cam.x = clamp(cam.x, m - BW * cam.s, v.w - m); cam.y = clamp(cam.y, m - BH * cam.s, v.h - m);
    board().style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.s})`;
    board().classList.toggle("far", cam.s < .5);
    drawMap();
  }
  function tween(to, dur = 620) {
    cancelAnimationFrame(anim); cancelAnimationFrame(inertiaRaf);
    if (reduced()) { Object.assign(cam, to); apply(); return; }
    const from = { ...cam }, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      cam.x = from.x + (to.x - from.x) * e; cam.y = from.y + (to.y - from.y) * e; cam.s = from.s + (to.s - from.s) * e;
      apply(); if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function zoomAt(ns, px, py, animate = false) {
    ns = clamp(ns, .18, 2.2);
    const bx = (px - cam.x) / cam.s, by = (py - cam.y) / cam.s;
    const to = { s: ns, x: px - bx * ns, y: py - by * ns };
    animate ? tween(to, 380) : (Object.assign(cam, to), apply());
  }
  const sheetW = () => ($("#sheet").classList.contains("on") ? $("#sheet").offsetWidth + 24 : 0);
  function fitAll(animate = true) {
    const w = vw(), h = vh(), s = clamp(Math.min((w - 48) / BW, (h - 48) / BH), .18, 1);
    const to = { s, x: (w - BW * s) / 2, y: Math.max(12, (h - BH * s) / 2) };
    animate ? tween(to) : (Object.assign(cam, to), apply());
  }
  function boxOf(el) { // board coordinates of any element inside the board
    let x = 0, y = 0, n = el;
    while (n && n !== board()) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }
  function focusIsland(slot, animate = true) {
    const b = boxOf(slot), w = vw() - sheetW(), h = vh();
    const s = clamp(Math.min((w - 96) / b.w, (h - 64) / b.h), .85, 1.2);
    const to = { s, x: (w - b.w * s) / 2 - b.x * s, y: b.h * s + 64 < h ? (h - b.h * s) / 2 - b.y * s : 32 - b.y * s };
    animate ? tween(to) : (Object.assign(cam, to), apply());
  }
  function focusEl(el) {
    const b = boxOf(el), w = vw() - sheetW(), h = vh(), s = Math.max(cam.s, 1);
    tween({ s, x: w / 2 - (b.x + b.w / 2) * s, y: h * .42 - (b.y + b.h / 2) * s });
  }

  function drawMap() {
    const mm = $("#minimap"), cv = $("canvas", mm);
    if (!BW || phone()) return;
    const W = 304, k = W / BW, H = Math.round(Math.min(220, BH * k));
    const kk = Math.min(k, H / BH);
    if (cv.height !== H) { cv.height = H; cv.style.height = H / 2 + "px"; }
    const g = cv.getContext("2d");
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(0,0,0,.13)";
    for (const b of boxes) { g.beginPath(); g.roundRect ? g.roundRect(b.x * kk, b.y * kk, b.w * kk, b.h * kk, 3) : g.rect(b.x * kk, b.y * kk, b.w * kk, b.h * kk); g.fill(); }
    const rx = -cam.x / cam.s * kk, ry = -cam.y / cam.s * kk, rw = vw() / cam.s * kk, rh = vh() / cam.s * kk;
    g.strokeStyle = "#0071e3"; g.lineWidth = 2; g.fillStyle = "rgba(0,113,227,.07)";
    g.beginPath(); g.roundRect ? g.roundRect(rx, ry, rw, rh, 4) : g.rect(rx, ry, rw, rh); g.fill(); g.stroke();
    mm.classList.toggle("on", rw < W - 2 || rh < H - 2 || rx > 1 || ry > 1);
    mm._k = kk;
  }

  function bindCanvas() {
    const view = $("#view");
    const ptrs = new Map();
    let drag = null, pinch = null, moved = false, vel = { x: 0, y: 0 }, last = null;
    const loc = e => { const r = view.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    view.addEventListener("pointerdown", e => {
      if (phone() || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelAnimationFrame(anim); cancelAnimationFrame(inertiaRaf);
      ptrs.set(e.pointerId, loc(e));
      if (ptrs.size === 1) { const p = loc(e); drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, active: false }; moved = false; vel = { x: 0, y: 0 }; last = { ...p, t: performance.now() }; }
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.s, bx: ((a.x + b.x) / 2 - cam.x) / cam.s, by: ((a.y + b.y) / 2 - cam.y) / cam.s };
        moved = true; for (const id of ptrs.keys()) try { view.setPointerCapture(id); } catch {}
      }
    });
    view.addEventListener("pointermove", e => {
      if (!ptrs.has(e.pointerId)) return;
      const p = loc(e); ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cam.s = clamp(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, .18, 2.2);
        cam.x = mx - pinch.bx * cam.s; cam.y = my - pinch.by * cam.s; apply(); return;
      }
      if (!drag) return;
      const dx = p.x - drag.sx, dy = p.y - drag.sy;
      if (!drag.active && Math.hypot(dx, dy) > 5) { drag.active = moved = true; try { view.setPointerCapture(e.pointerId); } catch {} view.classList.add("panning"); hideTip(); }
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
    view.addEventListener("click", e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; return; }
      if (!phone() && board().classList.contains("far")) { const s = e.target.closest(".slot"); if (s) { e.stopPropagation(); e.preventDefault(); focusIsland(s); } } }, true);
    view.addEventListener("dblclick", e => {
      if (phone()) return;
      const s = e.target.closest(".slot");
      if (s && !e.target.closest("[data-open],a,button")) focusIsland(s); else if (!s) fitAll();
    });
    view.addEventListener("wheel", e => {
      if (phone()) return;
      e.preventDefault(); cancelAnimationFrame(anim); cancelAnimationFrame(inertiaRaf); hideTip();
      const p = loc(e);
      if (e.ctrlKey || e.metaKey) zoomAt(cam.s * Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0085)), p.x, p.y);
      else { const k = e.deltaMode === 1 ? 32 : 1; cam.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k; cam.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k; apply(); }
    }, { passive: false });
    let gs = 1; // Safari trackpad pinch
    view.addEventListener("gesturestart", e => { e.preventDefault(); gs = cam.s; });
    view.addEventListener("gesturechange", e => { if (phone()) return; e.preventDefault(); const p = loc(e); zoomAt(gs * e.scale, p.x, p.y); });
    $("#minimap").addEventListener("click", e => {
      const r = $("#minimap canvas").getBoundingClientRect(), k = $("#minimap")._k / 2;
      const bx = (e.clientX - r.left) / k, by = (e.clientY - r.top) / k;
      tween({ s: cam.s, x: vw() / 2 - bx * cam.s, y: vh() / 2 - by * cam.s });
    });
  }

  // ---------------------------------------------------------------- phone: cards + map
  let tabsIdx = 0;
  function renderTabs() {
    const slots = $$(".slot", board());
    $("#tabs").innerHTML = slots.map((s, i) => `<button data-i="${i}">${esc($("h2", s).textContent)}</button>`).join("");
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
      focusEl(el);
    }
    el.classList.remove("hl"); void el.offsetWidth; el.classList.add("hl");
  }

  // ---------------------------------------------------------------- command palette
  function paletteItems() {
    return [
      ...D.atlas.people.map(p => ({ k: "person", id: p.id, label: p.name, sub: tx(p.role), hay: `${p.name} ${p.role.ru} ${p.role.en} ${tx(p.bio)}`, pic: p.kind === "group" ? icon(p) : avatar(p) })),
      ...D.atlas.products.map(p => ({ k: "product", id: p.id, label: p.name, sub: clusterLabel(p.cluster), hay: `${p.name} ${tx(p.description)} ${(p.children || []).map(c => c.name + " " + (c.apiId || "")).join(" ")}`, pic: icon(p) })),
      ...D.terms.map(g => ({ k: "term", id: g.id, label: g.term, sub: tx(g.definition).slice(0, 60) + "…", hay: `${g.term} ${(g.aliases || []).join(" ")}`, pic: `<span class="av sq">Aa</span>` })),
      ...D.events.map(e => ({ k: "event", id: e.id, label: tx(e.title), sub: fmtDate(e.date), hay: `${e.title.ru} ${e.title.en} ${tx(e.summary)}`, pic: `<span class="av sq num">${esc(String(+e.date.slice(8)))}</span>` }))
    ];
  }
  let PI = [], sel = 0, results = [];
  function openPalette() { PI = paletteItems(); $("#palette").classList.add("on"); $("#pscrim").classList.add("on"); const i = $("#palette input"); i.placeholder = t("search"); i.value = ""; search(""); setTimeout(() => i.focus(), 20); }
  function closePalette() { $("#palette").classList.remove("on"); $("#pscrim").classList.remove("on"); $("#palette input").blur(); }
  function search(q) {
    const n = s => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
    const words = n(q).split(/\s+/).filter(Boolean);
    results = (words.length ? PI.map(it => { const h = n(it.hay), l = n(it.label); if (!words.every(w => h.includes(w))) return null; return [it, (l.startsWith(words[0]) ? 0 : l.includes(words[0]) ? 1 : 2) + (it.k === "event" ? .5 : 0)]; }).filter(Boolean).sort((a, b) => a[1] - b[1]).map(x => x[0]) : PI.filter(i => i.k !== "event").slice(0, 10)).slice(0, 40);
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
    const dg = S.digest, el = $("#stamp");
    $("#lang").textContent = S.lang.toUpperCase();
    $("#find-lbl").textContent = t("find");
    if (!dg) { el.innerHTML = `${esc(t("updated"))} ${esc(fmtDate(D.atlas.meta.updatedAt))}`; return; }
    const when = new Date(dg.generatedAt), days = Math.floor((Date.now() - when) / 864e5);
    const day = days < 1 && new Date().toDateString() === when.toDateString() ? t("today") : days < 2 ? t("yesterday") : when.toLocaleDateString(locale(), { day: "numeric", month: "long" });
    el.innerHTML = `${esc(t("updated"))} <b>${esc(day)} ${esc(t("at"))} ${when.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}</b> · <a href="https://github.com/SharipovAkhror/athropic-atlas/blob/main/docs/METHODOLOGY.md" target="_blank" rel="noopener">${esc(t("method"))}</a>`;
  }
  function renderAll({ keepCamera = false } = {}) {
    renderBar();
    const keepPage = tabsIdx;
    board().innerHTML = "";
    for (const m of D.modules) if (!m.hidden && R[m.renderer]) R[m.renderer](m);
    document.documentElement.lang = S.lang;
    $$("img", board()).forEach(img => img.addEventListener("load", relayoutSoon, { once: true }));
    if (phone()) { renderTabs(); if (keepCamera) goPage(keepPage, false); }
    else { layout(); if (!keepCamera) startCamera(); else apply(); }
  }
  function startCamera() {
    const w = vw();
    const home = { s: w >= 1180 ? 1 : clamp(w / (COL * 3 + GAP * 2 + PAD * 2), .7, 1), x: 0, y: 0 };
    home.x = BW * home.s < w ? (w - BW * home.s) / 2 : 0;
    let first = false; try { first = !sessionStorage.getItem("atlas.intro"); sessionStorage.setItem("atlas.intro", "1"); } catch {}
    if (first && !reduced() && !location.hash) { fitAll(false); setTimeout(() => tween(home, 1100), 650); }
    else { Object.assign(cam, home); apply(); }
    if (!store.get("atlas.hint")) { const h = $("#hint"); h.textContent = t("hint"); setTimeout(() => h.classList.add("on"), 1900); setTimeout(() => h.classList.remove("on"), 7000); store.set("atlas.hint", "1"); }
  }

  // ---------------------------------------------------------------- events
  function bind() {
    document.addEventListener("click", e => {
      const o = e.target.closest("[data-open]");
      if (o) { e.preventDefault(); const [k, ...rest] = o.dataset.open.split(":"); if (!o.closest("#sheet")) S.stack = []; openEntity(k, rest.join(":")); hideTip(); return; }
      const g = e.target.closest("abbr.g");
      if (g) { e.preventDefault(); e.stopPropagation(); if (!g.closest("#sheet")) S.stack = []; hideTip(); openEntity("term", g.dataset.term); return; }
      const more = e.target.closest(".more[aria-expanded]");
      if (more) { const c = more.nextElementSibling; const open = !c.classList.contains("open"); c.classList.toggle("open", open); more.setAttribute("aria-expanded", open); relayoutSoon(); return; }
      const cr = e.target.closest("[data-crumb]");
      if (cr) { S.stack = S.stack.slice(0, +cr.dataset.crumb + 1); const s = S.stack.at(-1); openEntity(s.kind, s.id, { push: false }); return; }
      if (e.target.closest("[data-copy]")) navigator.clipboard?.writeText(location.href).then(() => toast(t("copied"))).catch(() => {});
    });
    document.addEventListener("mouseover", e => { const g = e.target.closest("abbr.g"); if (g && !$("#view").classList.contains("panning")) { const term = IDX.get(`term:${g.dataset.term}`); if (term) showTip(g, term.term, tx(term.definition)); } });
    document.addEventListener("mouseout", e => { if (e.target.closest("abbr.g")) hideTip(); });
    $("#scrim").addEventListener("click", closeSheet);
    $("#x").addEventListener("click", closeSheet);
    $("#pscrim").addEventListener("click", closePalette);
    $("#open-search").addEventListener("click", openPalette);
    $("#lang").addEventListener("click", cycleLang);
    const input = $("#palette input");
    input.addEventListener("input", () => search(input.value));
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
      else if (!phone() && e.key === "0") fitAll();
      else if (!phone() && e.key === "1") startHome();
      else if (!phone() && (e.key === "+" || e.key === "=")) zoomAt(cam.s * 1.25, vw() / 2, vh() / 2, true);
      else if (!phone() && (e.key === "-" || e.key === "_")) zoomAt(cam.s / 1.25, vw() / 2, vh() / 2, true);
      else if (!phone() && e.key.startsWith("Arrow") && !sheetOn) { const d = 140; tween({ s: cam.s, x: cam.x + (e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0), y: cam.y + (e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0) }, 260); }
    });
    addEventListener("hashchange", fromHash);
    let wasPhone = phone();
    addEventListener("resize", () => { const p = phone(); if (p !== wasPhone) { wasPhone = p; document.body.classList.remove("overview"); renderAll(); } else if (!p) apply(); });
    // swipe the sheet away (down on phones, right elsewhere)
    const sh = $("#sheet"); let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
    sh.addEventListener("touchstart", e => { if ($("#sheet-body").scrollTop > 0 && phone()) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dragging = true; dx = dy = 0; }, { passive: true });
    sh.addEventListener("touchmove", e => { if (!dragging) return; dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy; const d = phone() ? Math.max(0, dy) : Math.max(0, dx); if (d > 6) { sh.style.transition = "none"; sh.style.transform = phone() ? `translateY(${d}px)` : `translateX(${d}px)`; } }, { passive: true });
    sh.addEventListener("touchend", () => { if (!dragging) return; dragging = false; sh.style.transition = ""; sh.style.transform = ""; if ((phone() ? dy : dx) > 90) closeSheet(); });
  }
  function startHome() { const w = vw(); const s = w >= 1180 ? 1 : clamp(w / (COL * 3 + GAP * 2 + PAD * 2), .7, 1); tween({ s, x: BW * s < w ? (w - BW * s) / 2 : 0, y: 0 }); }
  function cycleLang() {
    S.lang = LANGS[(LANGS.indexOf(S.lang) + 1) % LANGS.length]; store.set("atlas.lang", S.lang);
    const st = S.stack.slice(); renderAll({ keepCamera: true });
    if (st.length) { S.stack = st; const s = st.at(-1); openEntity(s.kind, s.id, { push: false }); }
  }
  function fromHash() {
    const m = location.hash.match(/^#\/(person|product|event|term|fact)\/(.+)$/);
    if (m) { S.stack = []; const id = decodeURIComponent(m[2]); openEntity(m[1], id, { fromHash: true }); setTimeout(() => reveal(m[1], id), 120); }
  }

  // ---------------------------------------------------------------- boot
  const qlang = new URLSearchParams(location.search).get("lang"); if (LANGS.includes(qlang)) S.lang = qlang;
  load().then(() => { buildGloss(); bind(); bindCanvas(); bindPhone(); renderAll(); fromHash(); $("#loading").remove(); document.fonts?.ready.then(() => !phone() && layout()); })
    .catch(err => { $("#loading").textContent = `Не удалось загрузить данные. ${err.message}`; console.error(err); });
  window.ATLAS = { get data() { return D; }, openEntity, cam, fitAll };
})();

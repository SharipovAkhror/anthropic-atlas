/* Anthropic Atlas — renderer. Data lives in /data/*.json (see docs/METHODOLOGY.md). No build step.
   Modules are declared in data/modules.json; each module names a renderer below. Every entity opens in the same sheet template. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- i18n
  const UI = {
    ru: { updated: "Обновлено", today: "сегодня", yesterday: "вчера", at: "в", news: "новостей", added: "добавлено", updatedN: "изменено", removed: "убрано", noChanges: "Источники проверены, изменений нет", search: "Поиск людей, продуктов, событий, терминов", nothing: "Ничего не найдено", former: "Бывшие", trust: "Траст LTBT", board: "Совет директоров", votes: "Голоса акционеров", status: "Статус", since: "В компании", until: "До", zone: "Направление", released: "Выпуск", metrics: "Ключевое", owners: "Ответственные", children: "Состав", related: "Связи", events: "События", sources: "Источники", verified: "Проверено", links: "Справка", wikipedia: "Википедия", official: "Официально", docs: "Документация", wikidata: "Wikidata", github: "GitHub", site: "Сайт", linkedin: "LinkedIn", x: "X", reports: "Подчиняется", manages: "Руководит", oversees: "Совет / траст: надзор за", oversightBy: "Надзор: Совет / траст", products: "Продукты", active: "работает", preview: "превью", legacy: "предыдущее", retired: "выведен", deprecated: "устарел", formerS: "бывший", activeP: "в компании", copied: "Ссылка скопирована", asOf: "на", digestFor: "Сводка за", definition: "Определение", aliases: "Также", seeAlso: "Где встречается", all: "Все", newBadge: "новое", history: "Последние дни", source: "Источник", value: "Значение", note: "Пояснение", holder: "Держатель", economics: "Экономика", control: "Контроль", footer: "Данные из открытых источников, обновляются каждое утро. Каждое утверждение со ссылкой на источник.", method: "Методология", repo: "Репозиторий", keys: "Поиск", lang: "Язык", theme: "Тема", types: { model: "Модели", product: "Продукты", people: "Люди", governance: "Управление", finance: "Финансы", policy: "Политика", research: "Исследования", safety: "Безопасность", partnership: "Партнёрства", legal: "Право", infrastructure: "Платформа" } },
    en: { updated: "Updated", today: "today", yesterday: "yesterday", at: "at", news: "news", added: "added", updatedN: "updated", removed: "removed", noChanges: "Sources checked, no changes", search: "Search people, products, events, terms", nothing: "Nothing found", former: "Former", trust: "Long-Term Benefit Trust", board: "Board of directors", votes: "Shareholder votes", status: "Status", since: "Since", until: "Until", zone: "Area", released: "Released", metrics: "Key figure", owners: "Owners", children: "Includes", related: "Connections", events: "Events", sources: "Sources", verified: "Verified", links: "Reference", wikipedia: "Wikipedia", official: "Official", docs: "Docs", wikidata: "Wikidata", github: "GitHub", site: "Website", linkedin: "LinkedIn", x: "X", reports: "Reports to", manages: "Manages", oversees: "Board / trust oversight of", oversightBy: "Oversight: board / trust", products: "Products", active: "active", preview: "preview", legacy: "previous", retired: "retired", deprecated: "deprecated", formerS: "former", activeP: "current", copied: "Link copied", asOf: "as of", digestFor: "Digest for", definition: "Definition", aliases: "Also", seeAlso: "Mentioned in", all: "All", newBadge: "new", history: "Recent days", source: "Source", value: "Value", note: "Note", holder: "Holder", economics: "Economics", control: "Control", footer: "Built from public sources and refreshed every morning. Every claim links to its source.", method: "Methodology", repo: "Repository", keys: "Search", lang: "Language", theme: "Theme", types: { model: "Models", product: "Products", people: "People", governance: "Governance", finance: "Finance", policy: "Policy", research: "Research", safety: "Safety", partnership: "Partnerships", legal: "Legal", infrastructure: "Platform" } },
    uz: { updated: "Yangilandi", today: "bugun", yesterday: "kecha", at: "soat", news: "yangilik", added: "qo'shildi", updatedN: "o'zgardi", removed: "olib tashlandi", noChanges: "Manbalar tekshirildi, o'zgarish yo'q", search: "Odamlar, mahsulotlar, voqealar, atamalar", nothing: "Hech narsa topilmadi", former: "Sobiq", trust: "LTBT trasti", board: "Direktorlar kengashi", votes: "Aksiyadorlar ovozi", status: "Holat", since: "Kompaniyada", until: "Gacha", zone: "Yo'nalish", released: "Chiqarilgan", metrics: "Asosiy", owners: "Mas'ullar", children: "Tarkib", related: "Aloqalar", events: "Voqealar", sources: "Manbalar", verified: "Tekshirilgan", links: "Ma'lumot", wikipedia: "Vikipediya", official: "Rasmiy", docs: "Hujjatlar", wikidata: "Wikidata", github: "GitHub", site: "Sayt", linkedin: "LinkedIn", x: "X", reports: "Bo'ysunadi", manages: "Boshqaradi", oversees: "Nazorat qiladi", oversightBy: "Nazorat: kengash / trast", products: "Mahsulotlar", active: "faol", preview: "sinov", legacy: "oldingi", retired: "to'xtatilgan", deprecated: "eskirgan", formerS: "sobiq", activeP: "kompaniyada", copied: "Havola nusxalandi", asOf: "holatiga", digestFor: "Xulosa", definition: "Ta'rif", aliases: "Shuningdek", seeAlso: "Qayerda uchraydi", all: "Hammasi", newBadge: "yangi", history: "So'nggi kunlar", source: "Manba", value: "Qiymat", note: "Izoh", holder: "Egasi", economics: "Iqtisodiy", control: "Nazorat", footer: "Ochiq manbalar asosida, har kuni ertalab yangilanadi.", method: "Metodologiya", repo: "Repozitoriy", keys: "Qidiruv", lang: "Til", theme: "Mavzu", types: { model: "Modellar", product: "Mahsulotlar", people: "Odamlar", governance: "Boshqaruv", finance: "Moliya", policy: "Siyosat", research: "Tadqiqot", safety: "Xavfsizlik", partnership: "Hamkorlik", legal: "Huquq", infrastructure: "Platforma" } }
  };
  const LANGS = ["ru", "en", "uz"];
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const S = { lang: LANGS.includes(store.get("atlas.lang")) ? store.get("atlas.lang") : "ru", stack: [], filter: null, shown: 18, digest: null };
  const t = k => UI[S.lang][k] ?? UI.ru[k] ?? k;
  const tx = o => (o == null ? "" : typeof o === "string" ? o : o[S.lang] || o.ru || o.en || "");

  // ---------------------------------------------------------------- helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const locale = () => ({ ru: "ru-RU", en: "en-US", uz: "uz-Latn-UZ" }[S.lang]);
  function fmtDate(d, opts = { day: "numeric", month: "long", year: "numeric" }) {
    if (!d) return "";
    const parts = String(d).split(/[–-]/);
    if (/^\d{4}$/.test(d)) return d;
    if (/^\d{4}-\d{2}$/.test(d)) return new Date(d + "-01T12:00:00Z").toLocaleDateString(locale(), { month: "long", year: "numeric" });
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + "T12:00:00Z").toLocaleDateString(locale(), opts);
    return parts.length ? d : "";
  }
  const PALETTE = ["#8d6e63", "#5c7a99", "#7b8f6a", "#a0765a", "#6f6a9c", "#4f8a8b", "#9a6b7f", "#7d7a5a"];
  const colorFor = id => PALETTE[[...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
  function avatar(p, cls = "") {
    const img = p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : "";
    return `<span class="av ${cls}" style="--c:${colorFor(p.id)}">${esc(p.initials || p.name.slice(0, 2).toUpperCase())}${img}</span>`;
  }
  const icon = (p, cls = "") => `<span class="av sq ${cls}" style="--c:${colorFor(p.cluster || p.id)}">${esc((p.name.replace(/^Claude\s+/, "").replace(/[^\p{L}\p{N}]/gu, "") || "··").slice(0, 2))}</span>`;
  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 1600); }

  // ---------------------------------------------------------------- data
  let D;
  const IDX = new Map(); // "kind:id" -> entity
  async function getJSON(path) { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }
  async function load() {
    const [atlas, events, glossary, modules, digests] = await Promise.all(["/data/atlas.json", "/data/events.json", "/data/glossary.json", "/data/modules.json", "/data/digests/index.json"].map(p => getJSON(p).catch(() => null)));
    D = { atlas, events: events?.events || [], terms: glossary?.terms || [], modules: modules?.modules || [], digests: digests?.digests || [] };
    for (const p of atlas.people) IDX.set(`person:${p.id}`, { kind: "person", ...p });
    for (const p of atlas.products) IDX.set(`product:${p.id}`, { kind: "product", ...p });
    for (const e of D.events) IDX.set(`event:${e.id}`, { kind: "event", ...e });
    for (const g of D.terms) IDX.set(`term:${g.id}`, { kind: "term", ...g });
    for (const f of atlas.facts) IDX.set(`fact:${f.id}`, { kind: "fact", ...f });
    if (D.digests[0]) S.digest = await getJSON(`/data/digests/${D.digests[0].date}.json`).catch(() => null);
  }
  const byId = id => IDX.get(`person:${id}`) || IDX.get(`product:${id}`) || IDX.get(`event:${id}`) || IDX.get(`term:${id}`) || IDX.get(`fact:${id}`);
  const zoneLabel = id => tx(D.atlas.zones.find(z => z.id === id)?.label);
  const clusterLabel = id => tx(D.atlas.clusters.find(z => z.id === id)?.label);

  // ---------------------------------------------------------------- glossary auto-linking
  let glossRe = null, glossMap = new Map();
  function buildGloss() {
    const words = [];
    for (const g of D.terms) for (const w of [g.term, ...(g.aliases || [])]) if (w.length > 1) { words.push(w); glossMap.set(w.toLowerCase(), g.id); }
    words.sort((a, b) => b.length - a.length);
    const escRe = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
    glossRe = new RegExp(`(^|[^\\p{L}\\p{N}])(${words.map(escRe).join("|")})(?=$|[^\\p{L}\\p{N}])`, "giu");
  }
  function gloss(text) {
    const used = new Set();
    return esc(text).replace(glossRe, (m, pre, w) => {
      const id = glossMap.get(w.toLowerCase());
      if (!id || used.has(id)) return m;
      used.add(id);
      return `${pre}<abbr class="g" data-term="${id}">${w}</abbr>`;
    });
  }

  // ---------------------------------------------------------------- top bar
  function renderBar() {
    const dg = S.digest, el = $("#pulse");
    if (!dg) { el.innerHTML = `<i></i>${esc(t("updated"))} ${esc(fmtDate(D.atlas.meta.updatedAt))}`; return; }
    const when = new Date(dg.generatedAt), days = Math.floor((Date.now() - when) / 864e5);
    const day = days < 1 && new Date().toDateString() === when.toDateString() ? t("today") : days < 2 ? t("yesterday") : when.toLocaleDateString(locale(), { day: "numeric", month: "short" });
    el.classList.toggle("stale", days > 2);
    el.innerHTML = `<i></i><span class="long">${esc(t("updated"))}</span>${esc(day)} ${esc(t("at"))} ${when.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}`;
    $("#lang").textContent = S.lang.toUpperCase();
  }

  // ---------------------------------------------------------------- module renderers
  const R = {};

  R.digest = (m, root) => {
    const dg = S.digest;
    if (!dg) { root.innerHTML = ""; return; }
    const newsEv = dg.news.map(id => IDX.get(`event:${id}`)).filter(Boolean);
    const groups = [
      ["news", newsEv.length, newsEv.map(e => ({ sign: "•", cls: "", text: tx(e.title), id: e.id, kind: "event" }))],
      ["added", dg.added.length, dg.added.map(a => ({ sign: "+", cls: "add", text: a.label, id: a.id, kind: a.kind }))],
      ["updatedN", dg.updated.length, dg.updated.map(a => ({ sign: "~", cls: "", text: a.label, why: a.reason || (a.fields || []).join(", "), id: a.id, kind: a.kind }))],
      ["removed", dg.removed.length, dg.removed.map(a => ({ sign: "−", cls: "rem", text: a.label, why: a.reason, id: a.id, kind: a.kind }))]
    ];
    const hist = D.digests.slice(0, 30).reverse();
    root.innerHTML = `<div class="wrap today">
      <div class="date">${esc(t("digestFor"))} ${esc(fmtDate(dg.date))}</div>
      <h1>${esc(tx(dg.headline))}</h1>
      <p class="summary">${gloss(tx(dg.summary))}</p>
      <div class="counts">${groups.map(([k, n]) => `<button data-g="${k}" ${n ? "" : "disabled"} aria-expanded="false"><b class="num">${n}</b> ${esc(t(k))}</button>`).join("")}</div>
      <div class="digest-panel"><div><ul class="digest-list"></ul></div></div>
      ${hist.length > 1 ? `<div class="history" title="${esc(t("history"))}">${hist.map(h => { const c = h.counts || {}; const total = (c.news || 0) + (c.added || 0) + (c.updated || 0) + (c.removed || 0); return `<button data-d="${h.date}" class="${h.date === dg.date ? "on" : ""}" data-level="${total === 0 ? 0 : total < 4 ? 1 : total < 10 ? 2 : 3}" aria-label="${esc(fmtDate(h.date))}"></button>`; }).join("")}</div>` : ""}
    </div>`;
    const panel = $(".digest-panel", root), list = $(".digest-list", root);
    $$(".counts button", root).forEach(b => b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") === "true";
      $$(".counts button", root).forEach(x => x.setAttribute("aria-expanded", "false"));
      if (open) { panel.classList.remove("open"); return; }
      b.setAttribute("aria-expanded", "true");
      const items = groups.find(g => g[0] === b.dataset.g)[2];
      list.innerHTML = items.map(i => `<li class="${i.cls}"><span class="sign">${i.sign}</span><span><a href="#" class="ent-link" data-open="${i.kind}:${esc(i.id)}">${esc(i.text)}</a>${i.why ? ` <span class="why">— ${esc(i.why)}</span>` : ""}</span></li>`).join("");
      panel.classList.add("open");
    }));
    $$(".history button", root).forEach(b => {
      b.addEventListener("click", async () => { S.digest = await getJSON(`/data/digests/${b.dataset.d}.json`); R.digest(m, root); });
      b.addEventListener("mouseenter", () => showTip(b, fmtDate(b.dataset.d), tx(D.digests.find(d => d.date === b.dataset.d)?.headline)));
      b.addEventListener("mouseleave", hideTip);
    });
  };

  R.facts = (m, root) => {
    const facts = D.atlas.facts;
    root.innerHTML = `<div class="wrap"><div class="facts">${facts.map(f => `<div class="fact reveal" tabindex="0" data-open="fact:${f.id}">
      <div class="k">${esc(tx(f.label))}</div><div class="v num" data-count="${esc(f.value)}">${esc(f.value)}</div>
      <div class="n">${gloss(tx(f.note))}</div><div class="asof">${esc(t("asOf"))} ${esc(fmtDate(f.asOf, { day: "numeric", month: "short" }))}</div></div>`).join("")}</div></div>`;
  };

  R.timeline = (m, root) => {
    const types = [...new Set(D.events.map(e => e.type))];
    const counts = Object.fromEntries(types.map(ty => [ty, D.events.filter(e => e.type === ty).length]));
    root.innerHTML = `<div class="wrap"><div class="module-head"><h2>${esc(tx(m.title))}</h2>${m.lead ? `<p>${esc(tx(m.lead))}</p>` : ""}</div>
      <div class="filters">${types.sort((a, b) => counts[b] - counts[a]).map(ty => `<button class="chip" data-type="${ty}" style="--c:var(--t-${ty})"><i></i>${esc(t("types")[ty] || ty)} <span class="faint num">${counts[ty]}</span></button>`).join("")}</div>
      <div class="tl"></div><div class="sentinel"></div></div>`;
    const tl = $(".tl", root);
    const latest = S.digest?.date;
    const draw = () => {
      const evs = D.events.filter(e => !S.filter || e.type === S.filter).slice(0, S.shown);
      const days = [];
      for (const e of evs) { const last = days.at(-1); if (last && last.date === e.date) last.items.push(e); else days.push({ date: e.date, items: [e] }); }
      tl.innerHTML = days.map(d => `<div class="tl-day"><div class="tl-date num">${esc(fmtDate(d.date, { day: "numeric", month: "short", year: d.date.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "numeric" }))}</div><div class="tl-items">${d.items.map(e => `
        <div class="ev" data-id="${e.id}" data-imp="${e.importance}" style="--c:var(--t-${e.type})" tabindex="0">
          <div class="t">${esc(tx(e.title))}</div>
          <div class="meta"><span class="type">${esc(t("types")[e.type] || e.type)}</span><span>${esc(e.sources[0].title)}</span>${e.addedAt === latest ? `<span class="new">${esc(t("newBadge"))}</span>` : ""}</div>
          <div class="body"><div><p>${gloss(tx(e.summary))}</p>
            <div class="src">${e.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`).join("")}${(e.entities || []).map(id => byId(id)).filter(Boolean).map(x => `<a href="#" data-open="${x.kind}:${x.id}">${esc(x.name || tx(x.title))}</a>`).join("")}</div></div></div>
        </div>`).join("")}</div></div>`).join("");
      $$(".chip", root).forEach(c => { c.classList.toggle("on", c.dataset.type === S.filter); c.classList.toggle("dim", !!S.filter && c.dataset.type !== S.filter); });
    };
    draw();
    root.addEventListener("click", e => {
      const chip = e.target.closest(".chip");
      if (chip) { S.filter = S.filter === chip.dataset.type ? null : chip.dataset.type; S.shown = 18; draw(); return; }
      if (e.target.closest("a")) return;
      const ev = e.target.closest(".ev");
      if (ev) ev.classList.toggle("open");
    });
    root.addEventListener("keydown", e => { const ev = e.target.closest(".ev"); if (ev && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ev.classList.toggle("open"); } });
    new IntersectionObserver(es => { if (es[0].isIntersecting && S.shown < D.events.length) { S.shown += 18; draw(); } }, { rootMargin: "400px" }).observe($(".sentinel", root));
  };

  const isBoard = p => /Board|Director|Chair of the Board/i.test(p.role.en || "") && p.status === "active";
  const isTrustee = p => p.zone === "ltbt" && /Trust/i.test(p.role.en || "") && p.status === "active";
  const row = p => `<button class="row ${p.status === "former" ? "former" : ""}" data-open="person:${p.id}">${p.kind === "group" ? icon({ ...p, cluster: p.zone }) : avatar(p)}<span class="who"><span class="nm" style="display:block">${esc(p.name)}</span><span class="rl" style="display:block">${esc(tx(p.role))}</span></span><span class="side num">${esc(p.status === "former" ? (p.until || "").slice(0, 4) : (p.since || "").slice(0, 4))}</span></button>`;

  R.governance = (m, root) => {
    const people = D.atlas.people;
    const fVotes = parseFloat((D.atlas.facts.find(f => f.id === "class_f_votes") || {}).value) || 0;
    const trustees = people.filter(isTrustee), board = people.filter(isBoard), former = people.filter(p => ["ltbt", "capital"].includes(p.zone) && p.status === "former" && /Trust|Board|Director/i.test(p.role.en));
    root.innerHTML = `<div class="wrap"><div class="module-head"><h2>${esc(tx(m.title))}</h2>${m.lead ? `<p>${gloss(tx(m.lead))}</p>` : ""}</div>
      <div class="group-title"><span>${esc(t("votes"))}</span></div>
      <div class="votes reveal"><div style="background:var(--ink)" data-w="${fVotes}">Class F · ${fVotes}%</div><div style="background:var(--accent)" data-w="${(100 - fVotes).toFixed(1)}">Class A · ${(100 - fVotes).toFixed(1)}%</div></div>
      <div class="votes-legend">${D.atlas.shareClasses.map(c => `<div class="reveal"><b>${IDX.has(`term:${c.id}`) ? `<abbr class="g" data-term="${c.id}">${esc(c.name)}</abbr>` : esc(c.name)} · ${esc(tx(c.holder))}</b>${gloss(tx(c.control))}. <span class="faint">${esc(tx(c.economics))}</span></div>`).join("")}</div>
      <div class="gov-groups">
        <div class="reveal"><div class="group-title"><span>${gloss(t("trust"))}</span><span class="num">${trustees.length}</span></div>${trustees.map(row).join("")}</div>
        <div class="reveal"><div class="group-title"><span>${esc(t("board"))}</span><span class="num">${board.length}</span></div>${board.sort((a, b) => b.influence - a.influence).map(row).join("")}</div>
      </div>
      ${former.length ? `<button class="more" aria-expanded="false">${esc(t("former"))} · ${former.length}</button><div class="collapse"><div class="gov-groups" style="padding-top:6px"><div>${former.map(row).join("")}</div></div></div>` : ""}</div>`;
    const vb = $(".votes", root);
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { $$("div", vb).forEach(d => (d.style.width = d.dataset.w + "%")); o.disconnect(); } }, { threshold: .4 }).observe(vb);
  };

  R.people = (m, root) => {
    const zones = D.atlas.zones.filter(z => z.id !== "ltbt");
    root.innerHTML = `<div class="wrap"><div class="module-head"><h2>${esc(tx(m.title))}</h2><p class="num">${D.atlas.people.filter(p => p.status === "active" && p.kind === "person").length} ${esc(t("activeP"))}</p></div><div class="zones">${zones.map(z => {
      const ps = D.atlas.people.filter(p => p.zone === z.id);
      const act = ps.filter(p => p.status === "active").sort((a, b) => b.influence - a.influence), fm = ps.filter(p => p.status === "former");
      if (!ps.length) return "";
      return `<div class="reveal"><div class="group-title"><span>${esc(tx(z.label))}</span><span class="num">${act.length}</span></div>${act.map(row).join("")}
        ${fm.length ? `<button class="more" aria-expanded="false">${esc(t("former"))} · ${fm.length}</button><div class="collapse"><div>${fm.map(row).join("")}</div></div>` : ""}</div>`;
    }).join("")}</div></div>`;
  };

  R.products = (m, root) => {
    root.innerHTML = `<div class="wrap"><div class="module-head"><h2>${esc(tx(m.title))}</h2></div><div class="clusters">${D.atlas.clusters.map(c => {
      const ps = D.atlas.products.filter(p => p.cluster === c.id).sort((a, b) => ({ active: 0, preview: 1, legacy: 2, retired: 3 }[a.status] - { active: 0, preview: 1, legacy: 2, retired: 3 }[b.status]) || String(b.released).localeCompare(String(a.released)));
      if (!ps.length) return "";
      return `<div><div class="group-title"><span>${esc(tx(c.label))}</span><span class="num">${ps.length}</span></div><div class="cards">${ps.map(p => `<button class="card reveal" data-open="product:${p.id}">
        <span class="top"><span class="status ${p.status}">${esc(t(p.status))}</span><span class="num">${esc(fmtDate(p.released, { month: "short", year: "numeric" }))}</span></span>
        <span class="nm">${esc(p.name)}</span><span class="ds">${esc(tx(p.description))}</span>
        <span class="mt">${esc(p.metrics || "")}${p.children?.length ? ` · ${p.children.length} ›` : ""}</span></button>`).join("")}</div></div>`;
    }).join("")}</div></div>`;
  };

  R.glossary = (m, root) => {
    const cats = { governance: 1, finance: 2, safety: 3, models: 4, platform: 5, product: 6 };
    root.innerHTML = `<div class="wrap"><div class="module-head"><h2>${esc(tx(m.title))}</h2>${m.lead ? `<p>${esc(tx(m.lead))}</p>` : ""}</div><dl class="terms">${[...D.terms].sort((a, b) => (cats[a.category] || 9) - (cats[b.category] || 9)).map(g => `<div class="term reveal" data-term-row="${g.id}"><dt>${esc(g.term)}<small>${esc((g.aliases || []).slice(0, 2).join(" · "))}</small></dt><dd>${esc(tx(g.definition))}</dd></div>`).join("")}</dl></div>`;
    root.addEventListener("click", e => { const r = e.target.closest(".term"); if (r) { if (r.classList.contains("open")) openEntity("term", r.dataset.termRow); else r.classList.add("open"); } });
  };

  R.cards = (m, root) => { // generic renderer for new topics: any array of {id,name,description,sources}
    const [file, key] = (m.source || "").split("#");
    getJSON(`/data/${file}`).then(d => {
      const items = d[key] || [];
      for (const it of items) IDX.set(`product:${it.id}`, { kind: "product", status: "active", ...it });
      root.innerHTML = `<div class="wrap"><div class="module-head"><h2>${esc(tx(m.title))}</h2>${m.lead ? `<p>${esc(tx(m.lead))}</p>` : ""}</div><div class="cards">${items.map(p => `<button class="card reveal in" data-open="product:${p.id}"><span class="nm">${esc(p.name)}</span><span class="ds">${esc(tx(p.description))}</span><span class="mt">${esc(p.metrics || "")}</span></button>`).join("")}</div></div>`;
    }).catch(() => (root.innerHTML = ""));
  };

  // ---------------------------------------------------------------- sheet (one template for every entity kind)
  function linksHTML(links) {
    if (!links) return "";
    const order = ["wikipedia", "official", "docs", "github", "site", "linkedin", "x", "wikidata"];
    const ks = order.filter(k => links[k]);
    return ks.length ? `<div class="links">${ks.map(k => `<a href="${esc(links[k])}" target="_blank" rel="noopener">${esc(t(k))}</a>`).join("")}</div>` : "";
  }
  function sourcesHTML(e) {
    return `<div class="blk"><h4>${esc(t("sources"))}</h4><div class="sources">${(e.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`).join("")}</div>${e.verifiedAt ? `<div class="verified">${esc(t("verified"))}: ${esc(fmtDate(e.verifiedAt))}</div>` : ""}</div>`;
  }
  const relEvents = (id, name) => D.events.filter(e => (e.entities || []).includes(id) || (name && name.length > 5 && (tx(e.title) + " " + e.title.en).includes(name))).slice(0, 8);
  function eventsHTML(evs) { return evs.length ? `<div class="blk"><h4>${esc(t("events"))}</h4>${evs.map(e => `<div class="mini-ev" data-open="event:${e.id}">${esc(tx(e.title))}<small>${esc(fmtDate(e.date))}</small></div>`).join("")}</div>` : ""; }
  const kv = pairs => { const p = pairs.filter(([, v]) => v); return p.length ? `<dl class="kv">${p.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>` : ""; };

  const SHEET = {
    person(p) {
      const up = D.atlas.edges.filter(e => e.to === p.id).map(e => [e, byId(e.from)]).filter(x => x[1]);
      const down = D.atlas.edges.filter(e => e.from === p.id).map(e => [e, byId(e.to)]).filter(x => x[1]);
      const prods = D.atlas.products.filter(x => x.owners.includes(p.id));
      return `<div class="hd">${p.kind === "group" ? icon({ ...p, cluster: p.zone }, "lg") : avatar(p, "lg")}<div><h3 data-copy>${esc(p.name)}</h3><div class="sub">${esc(tx(p.role))}</div></div></div>
        ${p.bio ? `<p class="lead">${gloss(tx(p.bio))}</p>` : ""}
        ${linksHTML(p.links)}
        ${kv([[t("status"), esc(p.status === "former" ? t("formerS") : t("activeP"))], [t("since"), esc(fmtDate(p.since))], [t("until"), esc(fmtDate(p.until))], [t("zone"), esc(zoneLabel(p.zone))]])}
        ${up.length || down.length ? `<div class="blk"><h4>${esc(t("related"))}</h4>${up.map(([e, x]) => relRow(x, e.type === "gov" ? t("oversightBy") : t("reports"))).join("")}${down.map(([e, x]) => relRow(x, e.type === "gov" ? t("oversees") : t("manages"))).join("")}</div>` : ""}
        ${prods.length ? `<div class="blk"><h4>${esc(t("products"))}</h4>${prods.map(x => relRow(x, clusterLabel(x.cluster))).join("")}</div>` : ""}
        ${eventsHTML(relEvents(p.id, p.name))}${sourcesHTML(p)}`;
    },
    product(p) {
      const owners = (p.owners || []).map(byId).filter(Boolean);
      return `<div class="hd">${icon(p, "lg")}<div><h3 data-copy>${esc(p.name)}</h3><div class="sub"><span class="status ${p.status}">${esc(t(p.status))}</span> · ${esc(clusterLabel(p.cluster))}</div></div></div>
        <p class="lead">${gloss(tx(p.description))}</p>${linksHTML(p.links)}
        ${kv([[t("released"), esc(fmtDate(p.released))], [t("metrics"), p.metrics ? gloss(p.metrics) : ""]])}
        ${p.children?.length ? `<div class="blk"><h4>${esc(t("children"))}</h4>${p.children.map(c => `<div class="child"><span>${c.docs ? `<a class="ent-link" href="${esc(c.docs)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}${c.apiId ? `<br><code>${esc(c.apiId)}</code>` : ""}${c.note ? `<br><span class="faint">${esc(tx(c.note))}</span>` : ""}</span><span class="faint" style="text-align:right;white-space:nowrap"><span class="status ${c.status}">${esc(t(c.status))}</span><br>${esc(fmtDate(c.released, { day: "numeric", month: "short", year: "numeric" }))}</span></div>`).join("")}</div>` : ""}
        ${owners.length ? `<div class="blk"><h4>${esc(t("owners"))}</h4>${owners.map(x => relRow(x, tx(x.role))).join("")}</div>` : ""}
        ${eventsHTML(relEvents(p.id, p.name.split(/[,&(]/)[0].trim()))}${sourcesHTML(p)}`;
    },
    event(e) {
      const ents = (e.entities || []).map(byId).filter(Boolean);
      return `<div class="hd"><div><div class="sub" style="color:var(--t-${e.type})">${esc(t("types")[e.type])} · ${esc(fmtDate(e.date))}</div><h3 data-copy style="margin-top:4px">${esc(tx(e.title))}</h3></div></div>
        <p class="lead">${gloss(tx(e.summary))}</p>
        ${ents.length ? `<div class="blk"><h4>${esc(t("related"))}</h4>${ents.map(x => relRow(x, x.kind === "person" ? tx(x.role) : clusterLabel(x.cluster))).join("")}</div>` : ""}${sourcesHTML(e)}`;
    },
    term(g) {
      const re = new RegExp([g.term, ...(g.aliases || [])].map(w => w.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&")).join("|"), "i");
      const where = [...D.atlas.products, ...D.atlas.people].filter(x => re.test(tx(x.description) + tx(x.bio) + (x.metrics || ""))).slice(0, 8).map(x => byId(x.id));
      return `<div class="hd"><div><div class="sub">${esc(t("definition"))}</div><h3 data-copy style="margin-top:4px">${esc(g.term)}</h3></div></div>
        <p class="lead">${esc(tx(g.definition))}</p>${g.aliases?.length ? kv([[t("aliases"), esc(g.aliases.join(", "))]]) : ""}${linksHTML(g.links)}
        ${where.length ? `<div class="blk"><h4>${esc(t("seeAlso"))}</h4>${where.map(x => relRow(x, x.kind === "person" ? tx(x.role) : clusterLabel(x.cluster))).join("")}</div>` : ""}${sourcesHTML(g)}`;
    },
    fact(f) {
      return `<div class="hd"><div><div class="sub">${esc(tx(f.label))}</div><h3 data-copy style="margin-top:4px;font-size:34px" class="num">${esc(f.value)}</h3></div></div>
        <p class="lead">${gloss(tx(f.note))}</p>${kv([[t("asOf"), esc(fmtDate(f.asOf))]])}${sourcesHTML(f)}`;
    }
  };
  function relRow(x, sub) {
    const kind = x.kind || (IDX.has(`person:${x.id}`) ? "person" : "product");
    const pic = kind === "person" ? (x.kind === "group" ? icon({ ...x, cluster: x.zone }) : avatar(x)) : icon(x);
    return `<button class="row" data-open="${kind}:${x.id}">${pic}<span class="who"><span class="nm" style="display:block">${esc(x.name || tx(x.title))}</span><span class="rl" style="display:block">${esc(sub || "")}</span></span></button>`;
  }

  function openEntity(kind, id, { push = true, fromHash = false } = {}) {
    const e = IDX.get(`${kind}:${id}`);
    if (!e) return;
    if (push) { if (!S.stack.length || S.stack.at(-1).id !== id) S.stack.push({ kind, id }); }
    $("#sheet-body").innerHTML = SHEET[kind](e);
    $("#sheet-body").scrollTop = 0;
    $("#crumbs").innerHTML = S.stack.slice(-3).map((s, i, a) => { const x = IDX.get(`${s.kind}:${s.id}`); const nm = x.name || x.term || tx(x.title) || tx(x.label); return i === a.length - 1 ? `<span style="opacity:1;color:var(--ink-2)">${esc(nm)}</span>` : `<button data-crumb="${S.stack.length - a.length + i}">${esc(nm)}</button><span>/</span>`; }).join("");
    $("#sheet").classList.add("on"); $("#scrim").classList.add("on");
    if (!fromHash) try { history.replaceState(null, "", `#/${kind}/${id}`); } catch {}
  }
  function closeSheet() {
    $("#sheet").classList.remove("on"); $("#scrim").classList.remove("on"); S.stack = [];
    try { history.replaceState(null, "", location.pathname); } catch {}
  }
  function back() { if (S.stack.length > 1) { S.stack.pop(); const s = S.stack.at(-1); openEntity(s.kind, s.id, { push: false }); } else closeSheet(); }

  // ---------------------------------------------------------------- tooltip
  const tip = () => $("#tip");
  function showTip(anchor, title, body) {
    const el = tip(); el.innerHTML = `<b>${esc(title)}</b>${esc(body || "")}`;
    const r = anchor.getBoundingClientRect(); el.classList.add("show");
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
    el.style.top = (r.top - h - 10 < 8 ? r.bottom + 10 : r.top - h - 10) + "px";
  }
  function hideTip() { tip().classList.remove("show"); }

  // ---------------------------------------------------------------- command palette
  function paletteItems() {
    return [
      ...D.atlas.people.map(p => ({ k: "person", id: p.id, label: p.name, sub: tx(p.role), hay: `${p.name} ${p.role.ru} ${p.role.en} ${tx(p.bio)}`, pic: avatar(p) })),
      ...D.atlas.products.map(p => ({ k: "product", id: p.id, label: p.name, sub: clusterLabel(p.cluster), hay: `${p.name} ${tx(p.description)} ${(p.children || []).map(c => c.name + " " + (c.apiId || "")).join(" ")}`, pic: icon(p) })),
      ...D.terms.map(g => ({ k: "term", id: g.id, label: g.term, sub: tx(g.definition).slice(0, 60) + "…", hay: `${g.term} ${(g.aliases || []).join(" ")}`, pic: `<span class="av sq" style="--c:var(--ink-3)">Aa</span>` })),
      ...D.events.map(e => ({ k: "event", id: e.id, label: tx(e.title), sub: fmtDate(e.date), hay: `${e.title.ru} ${e.title.en} ${tx(e.summary)}`, pic: `<span class="av sq" style="--c:var(--t-${e.type})">${esc(e.date.slice(8))}</span>` }))
    ];
  }
  let PI = [], sel = 0, results = [];
  function openPalette() { PI = paletteItems(); $("#palette").classList.add("on"); $("#pscrim").classList.add("on"); const i = $("#palette input"); i.placeholder = t("search"); i.value = ""; search(""); setTimeout(() => i.focus(), 20); }
  function closePalette() { $("#palette").classList.remove("on"); $("#pscrim").classList.remove("on"); }
  function search(q) {
    const n = s => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
    const words = n(q).split(/\s+/).filter(Boolean);
    results = (words.length ? PI.map(it => { const h = n(it.hay), l = n(it.label); if (!words.every(w => h.includes(w))) return null; return [it, (l.startsWith(words[0]) ? 0 : l.includes(words[0]) ? 1 : 2) + (it.k === "event" ? .5 : 0)]; }).filter(Boolean).sort((a, b) => a[1] - b[1]).map(x => x[0]) : PI.filter(i => i.k !== "event").slice(0, 12)).slice(0, 40);
    sel = 0; drawResults();
  }
  function drawResults() {
    const ul = $("#palette ul");
    ul.innerHTML = results.length ? results.map((r, i) => `<li class="${i === sel ? "sel" : ""}" data-i="${i}">${r.pic}<span>${esc(r.label)}</span><small>${esc(r.sub)}</small></li>`).join("") : `<div class="empty">${esc(t("nothing"))}</div>`;
    ul.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  }
  function choose(i) { const r = results[i]; if (!r) return; closePalette(); S.stack = []; openEntity(r.k, r.id); }

  // ---------------------------------------------------------------- page
  function renderAll() {
    renderBar();
    const main = $("#main"); main.innerHTML = "";
    const rail = $("#rail"); rail.innerHTML = "";
    for (const m of D.modules) {
      if (m.hidden || !R[m.renderer]) continue;
      const sec = document.createElement("section");
      sec.className = "module"; sec.id = m.id; sec.dataset.renderer = m.renderer;
      main.appendChild(sec);
      R[m.renderer](m, sec);
      if (m.renderer !== "digest") rail.insertAdjacentHTML("beforeend", `<a href="#${m.id}" data-spy="${m.id}"><i></i><span>${esc(tx(m.title))}</span></a>`);
    }
    $("#foot").innerHTML = `<span>${esc(t("footer"))}</span><a href="https://github.com/SharipovAkhror/athropic-atlas/blob/main/docs/METHODOLOGY.md" target="_blank" rel="noopener">${esc(t("method"))}</a><a href="https://github.com/SharipovAkhror/athropic-atlas" target="_blank" rel="noopener">${esc(t("repo"))}</a><span><kbd>⌘K</kbd> ${esc(t("keys"))} · <kbd>L</kbd> ${esc(t("lang"))} · <kbd>T</kbd> ${esc(t("theme"))}</span>`;
    observe();
    document.documentElement.lang = S.lang;
  }

  let revealObs, spyObs;
  function observe() {
    revealObs?.disconnect(); spyObs?.disconnect();
    revealObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); countUp(e.target); revealObs.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    $$(".reveal").forEach((el, i) => { el.style.transitionDelay = `${Math.min(i % 8, 7) * 40}ms`; revealObs.observe(el); });
    spyObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) $$("#rail a").forEach(a => a.classList.toggle("on", a.dataset.spy === e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
    $$("section.module").forEach(s => spyObs.observe(s));
  }
  function countUp(el) {
    const v = el.querySelector?.("[data-count]");
    if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raw = v.dataset.count, m = raw.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return;
    const target = parseFloat(m[2].replace(",", ".")), dec = (m[2].split(/[.,]/)[1] || "").length, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); v.textContent = m[1] + (target * e).toFixed(dec) + m[3]; if (k < 1) requestAnimationFrame(step); else v.textContent = raw; };
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------- events
  function bind() {
    document.addEventListener("click", e => {
      const o = e.target.closest("[data-open]");
      if (o) { e.preventDefault(); const [k, ...rest] = o.dataset.open.split(":"); const id = rest.join(":"); if (!o.closest("#sheet")) S.stack = []; openEntity(k, id); hideTip(); return; }
      const g = e.target.closest("abbr.g");
      if (g) { e.preventDefault(); e.stopPropagation(); if (!g.closest("#sheet")) S.stack = []; hideTip(); openEntity("term", g.dataset.term); return; }
      const more = e.target.closest(".more");
      if (more) { const c = more.nextElementSibling; const open = !c.classList.contains("open"); c.classList.toggle("open", open); more.setAttribute("aria-expanded", open); return; }
      const cr = e.target.closest("[data-crumb]");
      if (cr) { S.stack = S.stack.slice(0, +cr.dataset.crumb + 1); const s = S.stack.at(-1); openEntity(s.kind, s.id, { push: false }); return; }
      const cp = e.target.closest("[data-copy]");
      if (cp) { navigator.clipboard?.writeText(location.href).then(() => toast(t("copied"))).catch(() => {}); }
    });
    document.addEventListener("mouseover", e => {
      const g = e.target.closest("abbr.g");
      if (g) { const term = IDX.get(`term:${g.dataset.term}`); if (term) showTip(g, term.term, tx(term.definition)); }
    });
    document.addEventListener("mouseout", e => { if (e.target.closest("abbr.g")) hideTip(); });
    $("#scrim").addEventListener("click", closeSheet);
    $("#x").addEventListener("click", closeSheet);
    $("#pscrim").addEventListener("click", closePalette);
    $("#open-search").addEventListener("click", openPalette);
    $("#lang").addEventListener("click", cycleLang);
    $("#pulse").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
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
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); openPalette(); }
      else if (e.key === "Escape") { if ($("#sheet").classList.contains("on")) back(); }
      else if (e.key === "Backspace" && $("#sheet").classList.contains("on")) { e.preventDefault(); back(); }
      else if (e.key.toLowerCase() === "l" && !e.metaKey && !e.ctrlKey) cycleLang();
      else if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey) toggleTheme();
    });
    addEventListener("scroll", () => $("#bar").classList.toggle("scrolled", scrollY > 8), { passive: true });
    addEventListener("hashchange", fromHash);
    // swipe the sheet away (right on desktop, down on phones)
    const sh = $("#sheet"); let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
    sh.addEventListener("touchstart", e => { if ($("#sheet-body").scrollTop > 0 && innerWidth <= 640) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dragging = true; dx = dy = 0; }, { passive: true });
    sh.addEventListener("touchmove", e => { if (!dragging) return; dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy; const mobile = innerWidth <= 640; const d = mobile ? Math.max(0, dy) : Math.max(0, dx); if (d > 6) { sh.style.transition = "none"; sh.style.transform = mobile ? `translateY(${d}px)` : `translateX(${d}px)`; } }, { passive: true });
    sh.addEventListener("touchend", () => { if (!dragging) return; dragging = false; sh.style.transition = ""; sh.style.transform = ""; const mobile = innerWidth <= 640; if ((mobile ? dy : dx) > 90) closeSheet(); });
  }
  function cycleLang() { S.lang = LANGS[(LANGS.indexOf(S.lang) + 1) % LANGS.length]; store.set("atlas.lang", S.lang); const st = S.stack.slice(); renderAll(); $$(".reveal").forEach(el => el.classList.add("in")); if (st.length) { S.stack = st; const s = st.at(-1); openEntity(s.kind, s.id, { push: false }); } }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; store.set("atlas.theme", next);
  }
  function fromHash() {
    const m = location.hash.match(/^#\/(person|product|event|term|fact)\/(.+)$/);
    if (m) { S.stack = []; openEntity(m[1], decodeURIComponent(m[2]), { fromHash: true }); }
  }

  // ---------------------------------------------------------------- boot
  const th = store.get("atlas.theme"); if (th) document.documentElement.dataset.theme = th;
  const qlang = new URLSearchParams(location.search).get("lang"); if (LANGS.includes(qlang)) S.lang = qlang;
  load().then(() => { buildGloss(); renderAll(); bind(); fromHash(); document.body.classList.add("ready"); })
    .catch(err => { $("#main").innerHTML = `<div class="wrap" style="padding:80px 0"><p class="muted">Не удалось загрузить данные. ${esc(err.message)}</p></div>`; console.error(err); });
  window.ATLAS = { get data() { return D; }, openEntity };
})();

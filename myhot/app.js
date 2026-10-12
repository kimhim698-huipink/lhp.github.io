(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const app = $("#app");
  const state = { snapshot: null, all: [], research: [], allById: new Map(), researchById: new Map(), hubById: new Map(),
    query: "", provider: "", kind: "", sort: "recent", page: 1, pageSize: 30 };
  let favorites = new Set();
  try { favorites = new Set(JSON.parse(localStorage.getItem("myhot-friends-favorites") || "[]")); } catch {}

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const truncate = (value, n = 500) => String(value ?? "").length > n ? `${String(value).slice(0, n)}…` : String(value ?? "");
  const date = (value, dateOnly = false) => {
    if (!value) return "时间待核";
    if (dateOnly || /^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(5, 7)}月${value.slice(8, 10)}日（仅日期）`;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "时间待核" : new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  };
  const safeExternal = (raw) => {
    try { const u = new URL(raw); return u.protocol === "https:" && !u.username && !u.password && !u.port ? u.href : null; } catch { return null; }
  };
  const route = () => {
    const raw = (location.hash || "#/selected").slice(2);
    const [pathname, search = ""] = raw.split("?");
    const parts = pathname.split("/").filter(Boolean);
    return { section: parts[0] || "selected", id: parts[1] || "", params: new URLSearchParams(search) };
  };
  const titleBlock = (eyebrow, title, subtitle = "", count = "") => `<div class="page-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>${count ? `<span class="count">${esc(count)}</span>` : ""}</div>`;
  const badge = (label) => `<span class="tag">${esc(label)}</span>`;
  const publicCount = () => state.all.filter((item) => item.provider === "aihot").length;
  const itemHref = (item) => state.researchById.has(item.id) || item.kind === "research"
    ? `#/research/${encodeURIComponent(item.id)}` : `#/item/${encodeURIComponent(item.id)}`;
  const sourceHref = (item) => safeExternal(item.sourceUrl || item.originalUrl);

  function card(item) {
    if (!item || !item.id) return "";
    const saved = favorites.has(item.id);
    const published = item.publishedAt ? date(item.publishedAt) : item.sourceDate ? date(item.sourceDate, true) : item.discoveredAt ? `收录 ${date(item.discoveredAt)}` : "时间待核";
    const source = item.sourceName || item.source || item.provider || "来源待核";
    const summary = item.summary || item.excerpt || "";
    const research = state.researchById.has(item.id) || item.kind === "research";
    const labels = item.tags?.length ? `<div class="tag-row">${item.tags.slice(0, 4).map(badge).join("")}</div>` : "";
    return `<article class="card"><div class="card-meta"><span class="provider">${esc(source)}</span><span>${esc(published)}</span>${research ? `<span>${esc(item.contentLabel || item.evidence || "研究资料")}</span>` : ""}</div>
      <a class="card-title" href="${itemHref(item)}">${esc(item.title)}</a>${summary ? `<p class="card-summary">${esc(truncate(summary, 620))}</p>` : ""}${labels}
      <div class="card-actions"><a href="${itemHref(item)}">${research ? "查看资料" : "查看动态"}</a>${sourceHref(item) ? `<a href="${esc(sourceHref(item))}" target="_blank" rel="noopener noreferrer">${research ? "去来源平台阅读 ↗" : "来源页 ↗"}</a>` : ""}<button class="save ${saved ? "active" : ""}" type="button" data-fav="${esc(item.id)}" aria-label="${saved ? "取消收藏" : "收藏"}">${saved ? "★" : "☆"}</button></div></article>`;
  }

  function sourceStatus() {
    const list = state.snapshot.hubs.selected.sources || [];
    return `<div class="source-grid">${list.map((source) => {
      const aiHotItems = source.provider === "aihot" ? state.all.filter((item) => item.provider === "aihot") : null;
      const total = aiHotItems ? aiHotItems.length : source.count ?? 0;
      return `<div class="source-box"><strong>${esc(source.label || source.provider)}</strong><b>${esc(total)}</b><span>已收录 · 更新 ${esc(date(source.lastSyncedAt))}</span><p>${source.provider === "aihot" ? "公开动态可直接阅读" : "原文请按来源平台权限访问"}</p></div>`;
    }).join("")}</div>`;
  }

  function selected() {
    const hub = state.snapshot.hubs.selected;
    return titleBlock("MYHOT · SHARE", "精选", "AI 产业动态与投资研究，按来源保留原始阅读入口。", `${state.snapshot.researchTotal.toLocaleString()} 份研究 · ${publicCount().toLocaleString()} 条公开动态`)
      + `<div class="stat-row"><div class="stat"><strong>${state.snapshot.researchTotal.toLocaleString()}</strong><span>研究资料索引</span></div><div class="stat"><strong>${state.snapshot.detailTotal.toLocaleString()}</strong><span>本站可读公开摘要</span></div><div class="stat"><strong>${publicCount().toLocaleString()}</strong><span>公开 AI 动态</span></div><div class="stat"><strong>${esc(hub.themes?.length || 0)}</strong><span>产业主题</span></div></div>`
      + `<div class="two-col"><section><div class="section-heading"><h2>研究优先看</h2><a href="#/research">查看全部</a></div><div class="card-list">${hub.research.slice(0, 12).map(card).join("")}</div></section><section><div class="section-heading"><h2>公开 AI 动态</h2><a href="#/all">查看全部</a></div><div class="card-list">${hub.publicItems.slice(0, 12).map(card).join("")}</div></section></div>`
      + `<div class="section-heading"><h2>来源覆盖</h2></div>${sourceStatus()}`;
  }

  function toolbar(section) {
    const providerOptions = section === "research"
      ? [["", "全部来源"], ["alphapai", "AlphaPai"], ["alphaengine", "AlphaEngine"], ["wind", "Wind"], ["official-product-update", "官方产品动态"]]
      : [["", "全部来源"], ["alphapai", "AlphaPai"], ["alphaengine", "AlphaEngine"], ["wind", "Wind"], ["aihot", "AIHOT 公开"]];
    const kind = section === "all" ? `<select name="kind" aria-label="内容类型"><option value="">全部类型</option><option value="research" ${state.kind === "research" ? "selected" : ""}>研究资料</option><option value="news" ${state.kind === "news" ? "selected" : ""}>公开动态</option></select>` : "";
    return `<form class="toolbar" id="filter-form"><input name="query" type="search" value="${esc(state.query)}" placeholder="搜索公司、模型、产业链…" aria-label="搜索标题与摘要"><select name="provider" aria-label="来源">${providerOptions.map(([v, t]) => `<option value="${v}" ${state.provider === v ? "selected" : ""}>${t}</option>`).join("")}</select>${kind}<select name="sort" aria-label="排序"><option value="recent" ${state.sort === "recent" ? "selected" : ""}>最新发布</option><option value="importance" ${state.sort === "importance" ? "selected" : ""}>研究重要性</option><option value="heat" ${state.sort === "heat" ? "selected" : ""}>传播热度</option></select><button type="submit">筛选</button></form>`;
  }

  function filterItems(items, section, theme = "") {
    const q = state.query.trim().toLocaleLowerCase();
    const provider = state.provider;
    const kind = state.kind;
    const filtered = items.filter((item) => {
      if (q && !`${item.title || ""} ${item.summary || item.excerpt || ""} ${item.source || item.sourceName || ""}`.toLocaleLowerCase().includes(q)) return false;
      const p = String(item.provider || item.sourceId || "").toLocaleLowerCase();
      if (provider && !(provider === "aihot" ? item.kind !== "research" && !state.researchById.has(item.id) : p.includes(provider))) return false;
      if (section === "all" && kind && (kind === "research" ? !(item.kind === "research" || state.researchById.has(item.id)) : item.kind === "research" || state.researchById.has(item.id))) return false;
      if (theme && !(item.tags || []).includes(theme)) return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (state.sort === "importance") return (b.researchImportance ?? b.review?.importance ?? -1) - (a.researchImportance ?? a.review?.importance ?? -1);
      if (state.sort === "heat") return (b.propagationHeat ?? b.attention?.heat ?? -1) - (a.propagationHeat ?? a.attention?.heat ?? -1);
      return (b.publishedAt || b.sourceDate || b.discoveredAt || b.collectedAt || "").localeCompare(a.publishedAt || a.sourceDate || a.discoveredAt || a.collectedAt || "");
    });
    return filtered;
  }

  function paged(items) {
    const pageCount = Math.max(1, Math.ceil(items.length / state.pageSize));
    state.page = Math.min(Math.max(state.page, 1), pageCount);
    const slice = items.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    return `${slice.length ? `<div class="card-list">${slice.map(card).join("")}</div>` : `<div class="empty">没有匹配的内容。调整筛选条件后再试。</div>`}<div class="pager"><span>第 ${state.page} / ${pageCount} 页 · 共 ${items.length.toLocaleString()} 条</span><div><button type="button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>上一页</button><button type="button" data-page="${state.page + 1}" ${state.page === pageCount ? "disabled" : ""}>下一页</button></div></div>`;
  }

  function all() {
    const theme = route().params.get("theme") || "";
    const items = filterItems(state.all, "all", theme);
    const themeName = state.snapshot.hubs.topics.themes?.find((item) => item.id === theme)?.name || theme;
    return titleBlock("ALL AI", theme ? `全部 AI 动态 · ${themeName}` : "全部 AI 动态", "公开资讯与研究目录统一按时间查阅；研究原文按来源平台权限访问。", `${state.all.length.toLocaleString()} 条已接入`) + toolbar("all") + paged(items);
  }
  function research() {
    const items = filterItems(state.research, "research");
    return titleBlock("PRIVATE RESEARCH", "私人研究索引", "查看 AlphaPai、AlphaEngine、Wind 资料的标题、时间和来源入口；原文需来源平台账号与权限。", `${state.research.length.toLocaleString()} 份资料`) + toolbar("research") + `<p class="small-note">公开分享页不提供这些平台的私有摘要、纪要或正文。研究重要性与传播热度分开记录。</p>` + paged(items);
  }
  function hot() {
    const hub = state.snapshot.hubs.hot;
    return titleBlock("TRENDING", "热点榜", "传播热度反映多来源关注与时间变化，与研究重要性分开。", `${hub.hot.length} 个热点`) + `<div class="card-list">${hub.hot.map(card).join("")}</div>`;
  }
  function daily() {
    const hub = state.snapshot.hubs.daily;
    const d = hub.privateDaily;
    if (!d) return titleBlock("DAILY", "AI 日报") + `<div class="empty">本期日报暂未生成。</div>`;
    const groups = [["public", "公开 AI 动态"], ["researchTimed", "有明确发布时间的研究"], ["researchDateOnly", "仅有来源日期的研究"], ["alphaengineRecent", "AlphaEngine 最近接入"]];
    return titleBlock("DAILY · 22:45 BJT", `AI 日报 · ${d.date}`, "以北京时间 22:45 为窗口终点；具体时间以来源页面为准。")
      + `<div class="daily-intro"><strong>本期阅读</strong>公开动态 ${esc(d.counts.publicInWindow)} 条 · 定时研究 ${esc(d.counts.researchInWindow)} 条 · 仅日期研究 ${esc(d.counts.dateOnlyResearch)} 条。来源同步状态：${esc(d.publicStatus)}。</div>`
      + groups.map(([key, label]) => `<section class="daily-section"><div class="section-heading"><h2>${label}</h2><span class="count">${(d.sections[key] || []).length} 条</span></div><div class="card-list">${(d.sections[key] || []).map(card).join("") || `<div class="empty">本期暂无此类材料。</div>`}</div></section>`).join("")
      + `<p class="small-note">${esc((d.notes || []).join(" "))}</p>`;
  }
  function topics() {
    const themes = state.snapshot.hubs.topics.themes || [];
    return titleBlock("TOPICS", "主题", "按产业方向浏览看板中的研究与动态。", `${themes.length} 个主题`)
      + `<div class="theme-grid">${themes.map((item) => {
        const tagged = state.all.filter((card) => (card.tags || []).includes(item.id));
        const publicTagged = tagged.filter((card) => card.provider === "aihot").length;
        return `<a class="theme" href="#/all?theme=${encodeURIComponent(item.id)}"><strong>${esc(item.name)}</strong><span>${tagged.length.toLocaleString()} 条内容 · 公开 ${publicTagged.toLocaleString()} 条</span></a>`;
      }).join("")}</div>`;
  }
  function starred() {
    const items = [...favorites].map((id) => state.researchById.get(id) || state.allById.get(id)).filter(Boolean);
    return titleBlock("SAVED", "收藏", "此浏览器保存的阅读清单；仅在当前设备可见。", `${items.length} 条`) + `<div class="card-list">${items.map(card).join("") || `<div class="empty">还没有收藏。打开资料后点击右下角星号即可保存。</div>`}</div>`;
  }
  function about() {
    const s = state.snapshot;
    return titleBlock("ABOUT", "关于这份看板", "MyHOT 的公开只读朋友阅读版。")
      + `<div class="notice"><strong>分享方式：</strong>把此网站的网址发给朋友，对方直接打开公开动态和研究索引，无需 ChatGPT 或邮箱账号。AlphaPai、AlphaEngine、Wind 的私有摘要、纪要及正文不在此站发布；阅读原文需朋友自己的来源平台账号与权限。</div>`
      + `<div class="stat-row"><div class="stat"><strong>${s.researchTotal.toLocaleString()}</strong><span>研究资料索引</span></div><div class="stat"><strong>${s.allTotal.toLocaleString()}</strong><span>全部动态</span></div><div class="stat"><strong>${s.detailTotal.toLocaleString()}</strong><span>本站可读公开摘要</span></div><div class="stat"><strong>只读</strong><span>朋友无法改动你的评分</span></div></div>`
      + `<p class="small-note">本次云端快照生成于 ${esc(date(s.exportedAt))}。新资料会在下一次同步后进入分享版。</p>`;
  }

  function readableBody(value) {
    const text = String(value || "").replace(/\r/g, "").replace(/(?<=[。；])\s*(?=(?:[一二三四五六七八九十]+[、.]|\d{1,2}[.、]\s*[\u4e00-\u9fa5]))/g, "\n\n");
    const paragraphs = text.split(/\n{2,}/).flatMap((part) => {
      const lines = part.split(/\n/).map((line) => line.trim()).filter(Boolean);
      if (!lines.length) return [];
      return lines.flatMap((line) => {
        if (line.length < 360) return [line];
        const sentences = line.match(/[^。！？；]+[。！？；]?/g) || [line];
        const chunks = []; let chunk = "";
        for (const sentence of sentences) { if (chunk.length > 250) { chunks.push(chunk); chunk = ""; } chunk += sentence; }
        if (chunk) chunks.push(chunk);
        return chunks;
      });
    });
    return paragraphs.map((line) => /^\s*(?:[一二三四五六七八九十]+[、.]|\d{1,2}[.、])/.test(line) && line.length < 90
      ? `<h2>${esc(line)}</h2>` : `<p>${esc(line)}</p>`).join("");
  }
  function detailFrame(item, body, isResearch) {
    const source = item.sourceName || item.source || item.provider || "来源待核";
    const link = sourceHref(item);
    const restricted = isResearch && item.access === "source_account_required";
    const text = restricted ? "" : body || item.summary || item.excerpt || "目前只保存标题和来源信息。";
    const label = restricted ? "研究资料索引" : item.contentLabel || (isResearch ? "公开摘要" : "AI 动态摘要");
    return `<div class="detail"><a class="back" href="${isResearch ? "#/research" : "#/all"}">← 返回列表</a><p class="eyebrow">${esc(source)} · ${esc(label)}</p><h1>${esc(item.title)}</h1><div class="detail-meta"><span>来源时间：${esc(item.publishedAt ? date(item.publishedAt) : item.sourceDate ? date(item.sourceDate, true) : "待核")}</span><span>资料类型：${esc(item.evidenceLevel || item.evidence || "待核")}</span>${item.review?.importance != null ? `<span>研究重要性：${esc(item.review.importance)}/100</span>` : ""}</div>${link ? `<a class="source-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${restricted ? "去来源平台阅读 ↗" : "打开来源页 ↗"}</a>` : `<p class="small-note">尚无已核验的来源直链。</p>`}${restricted ? `<div class="notice">这份资料的摘要、纪要和正文保存在来源平台；请用你自己的来源平台账号和权限阅读。</div>` : `<div class="detail-body">${readableBody(text)}</div><p class="small-note">请以来源原文核验关键数字、判断和限定条件。</p>`}</div>`;
  }
  function researchDetail(id) {
    const item = state.researchById.get(id);
    if (!item) { app.innerHTML = `<div class="empty">未找到这份资料。</div>`; return; }
    app.innerHTML = detailFrame(item, item.excerpt, true);
  }
  function itemDetail(id) {
    const item = state.allById.get(id) || state.hubById.get(id);
    app.innerHTML = item ? detailFrame(item, item.summary, false) : `<div class="empty">未找到这条动态。</div>`;
  }

  function render() {
    if (!state.snapshot) return;
    const current = route();
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === current.section) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    if (current.section === "research" && current.id) return researchDetail(current.id);
    if (current.section === "item" && current.id) return itemDetail(current.id);
    const pages = { selected, research, all, hot, daily, topics, starred, about };
    app.innerHTML = (pages[current.section] || selected)();
  }

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "filter-form") return;
    event.preventDefault();
    const form = new FormData(event.target);
    state.query = String(form.get("query") || "").trim().slice(0, 200);
    state.provider = String(form.get("provider") || "");
    state.kind = String(form.get("kind") || "");
    state.sort = String(form.get("sort") || "recent");
    state.page = 1;
    render();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page],[data-fav]");
    if (!button) return;
    if (button.dataset.page) { state.page = Number(button.dataset.page); render(); window.scrollTo({ top: 0, behavior: "instant" }); }
    if (button.dataset.fav) {
      const id = button.dataset.fav;
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      try { localStorage.setItem("myhot-friends-favorites", JSON.stringify([...favorites])); } catch {}
      render();
    }
  });
  $("#menu-button").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menu-button").setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll(".sidebar nav a").forEach((link) => link.addEventListener("click", () => {
    $("#sidebar").classList.remove("open");
    $("#menu-button").setAttribute("aria-expanded", "false");
  }));
  window.addEventListener("hashchange", () => { state.page = 1; render(); window.scrollTo({ top: 0, behavior: "instant" }); });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") $("#sidebar").classList.remove("open"); });

  Promise.all(["snapshot", "all", "research"].map(async (name) => {
    const response = await fetch(`./data/${name}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`无法读取 ${name} 数据`);
    return response.json();
  })).then(([snapshot, allItems, researchItems]) => {
    state.snapshot = snapshot;
    state.all = allItems;
    state.research = researchItems;
    state.allById = new Map(allItems.map((item) => [item.id, item]));
    state.researchById = new Map(researchItems.map((item) => [item.id, item]));
    const hubCards = [
      ...(snapshot.hubs.selected.research || []),
      ...(snapshot.hubs.selected.publicItems || []),
      ...(snapshot.hubs.hot.hot || []),
      ...Object.values(snapshot.hubs.daily.privateDaily?.sections || {}).flat(),
    ];
    state.hubById = new Map(hubCards.map((item) => [item.id, item]));
    $("#sync-label").textContent = `快照 ${date(snapshot.exportedAt)}（北京）`;
    render();
  }).catch((error) => { app.innerHTML = `<div class="error">看板暂时无法读取：${esc(error.message)}。请稍后刷新。</div>`; });
})();

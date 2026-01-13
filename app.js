// app.js（台股已移除，只留美股）
// 你的 Cloudflare Worker 網址（不要結尾斜線）
const API_BASE = "https://square-poetry-154f.benbenben0937267.workers.dev";

// -----------------------------
// DOM
// -----------------------------
const qEl = document.getElementById("q");
const goEl = document.getElementById("go");
const listEl = document.getElementById("list");
const sortEl = document.getElementById("sort");
const loadingEl = document.getElementById("loading");
const statusPill = document.getElementById("statusPill");
const toastEl = document.getElementById("toast");

const usFocusEl = document.getElementById("usFocus");
const usFocusSub = document.getElementById("usFocusSub");

const usSectorsEl = document.getElementById("usSectors");
const usCompaniesEl = document.getElementById("usCompanies");

const resultTitleEl = document.getElementById("resultTitle");
const resultSubEl = document.getElementById("resultSub");
const toggleFavEl = document.getElementById("toggleFav");

// -----------------------------
// 設定：焦點 / 產業快捷 / 公司
// -----------------------------
const US_FOCUS_QUERY = "S&P 500 Nasdaq Dow Jones stock market focus";

const US_SECTORS = [
  { label: "科技業", q: "US stocks technology AI semiconductors" },
  { label: "通訊業", q: "US stocks communication services telecom" },
  { label: "消費業", q: "US stocks consumer discretionary retail" },
  { label: "金融業", q: "US stocks financials banks" },
  { label: "醫療保健業", q: "US stocks healthcare pharma biotech" },
  { label: "工業/國防/航太", q: "US stocks industrial defense aerospace" },
  { label: "能源/原物料", q: "US stocks energy materials oil gas commodities" },
];

const US_COMPANIES = [
  { label: "AAPL", q: "Apple AAPL" },
  { label: "MSFT", q: "Microsoft MSFT" },
  { label: "NVDA", q: "Nvidia NVDA" },
  { label: "AMZN", q: "Amazon AMZN" },
  { label: "GOOGL", q: "Google Alphabet GOOGL" },
  { label: "TSLA", q: "Tesla TSLA" },
  { label: "JPM", q: "JPMorgan JPM" },
  { label: "XOM", q: "ExxonMobil XOM" },
  { label: "LMT", q: "Lockheed Martin LMT" },
  { label: "BA", q: "Boeing BA" },
  { label: "JNJ", q: "Johnson & Johnson JNJ" },
];

// -----------------------------
// 收藏：localStorage
// -----------------------------
const FAV_KEY = "finance_news_favs_v1";
function loadFavs() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveFavs(favs) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}
let favs = loadFavs();
let showFavOnly = false;

// -----------------------------
// 工具
// -----------------------------
function setStatus(text) {
  statusPill.textContent = text;
}
function showToast(text) {
  toastEl.textContent = text;
  toastEl.style.display = "block";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toastEl.style.display = "none"), 1800);
}

function toTimeText(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function normalizeTitle(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isValidDesc(desc) {
  if (!desc) return false;
  const s = String(desc).trim();
  if (!s) return false;
  if (s === "[Removed]") return false;
  return true;
}

function dedupeByTitle(articles) {
  const seen = new Set();
  const out = [];
  for (const a of articles) {
    const key = normalizeTitle(a.title);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function sortArticles(articles, mode) {
  const sign = mode === "old" ? 1 : -1;
  return [...articles].sort((a, b) => {
    const ta = new Date(a.publishedAt || 0).getTime() || 0;
    const tb = new Date(b.publishedAt || 0).getTime() || 0;
    return (ta - tb) * sign;
  });
}

function setLoading(on) {
  loadingEl.style.display = on ? "flex" : "none";
}

// -----------------------------
// API
// -----------------------------
async function fetchArticles(query, pageSize = 20) {
  const url = `${API_BASE}/api/articles?q=${encodeURIComponent(query)}&pageSize=${pageSize}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.status === "error") {
    const msg = data?.message || data?.error || "API error";
    throw new Error(msg);
  }

  const items = Array.isArray(data.articles) ? data.articles : [];
  return items;
}

// -----------------------------
// UI 渲染
// -----------------------------
function articleCard(article, { showStar = true } = {}) {
  const title = article.title || "(no title)";
  const url = article.url || "#";
  const sourceName = article?.source?.name || "Unknown";
  const published = toTimeText(article.publishedAt);

  const descOk = isValidDesc(article.description);
  const desc = descOk ? article.description : "";

  const isFav = !!favs[url];

  const card = document.createElement("div");
  card.className = "card";

  const actions = document.createElement("div");
  actions.className = "actions";

  if (showStar) {
    const starBtn = document.createElement("button");
    starBtn.className = "iconbtn" + (isFav ? " active" : "");
    starBtn.textContent = isFav ? "已收藏" : "收藏";
    starBtn.onclick = () => {
      if (!url || url === "#") {
        showToast("這則新聞缺少 URL，無法收藏");
        return;
      }
      if (favs[url]) {
        delete favs[url];
        saveFavs(favs);
        starBtn.className = "iconbtn";
        starBtn.textContent = "收藏";
        showToast("已取消收藏");
      } else {
        favs[url] = {
          title,
          url,
          sourceName,
          publishedAt: article.publishedAt || "",
          description: descOk ? desc : "",
        };
        saveFavs(favs);
        starBtn.className = "iconbtn active";
        starBtn.textContent = "已收藏";
        showToast("已加入收藏");
      }
    };
    actions.appendChild(starBtn);
  }

  card.appendChild(actions);

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.textContent = title;
  a.style.fontSize = "18px";
  a.style.display = "inline-block";
  a.style.marginRight = "64px";
  card.appendChild(a);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${sourceName} · ${published}`;
  card.appendChild(meta);

  if (descOk) {
    const d = document.createElement("div");
    d.className = "desc";
    d.textContent = desc;
    card.appendChild(d);
  }

  return card;
}

function renderList(articles, { title, subtitle } = {}) {
  listEl.innerHTML = "";
  if (title) resultTitleEl.textContent = title;
  resultSubEl.textContent = subtitle || "";

  if (!articles.length) {
    const empty = document.createElement("div");
    empty.className = "sub";
    empty.textContent = "沒有找到結果。";
    listEl.appendChild(empty);
    return;
  }

  for (const a of articles) {
    listEl.appendChild(articleCard(a));
  }

  // 搜尋後自動捲到結果區
  document.getElementById("resultTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderFocus(el, article) {
  el.innerHTML = "";
  if (!article) {
    el.textContent = "目前找不到焦點新聞。";
    return;
  }
  const card = articleCard(article, { showStar: true });
  el.appendChild(card);
}

function makeButtons(container, items, { prefix } = {}) {
  container.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.textContent = it.label;
    b.onclick = () => runSearch(it.q, { label: `${prefix || ""}${it.label}` });
    container.appendChild(b);
  }
}

function renderFavList() {
  const values = Object.values(favs);
  const deduped = dedupeByTitle(
    values.map(v => ({
      title: v.title,
      url: v.url,
      description: v.description,
      publishedAt: v.publishedAt,
      source: { name: v.sourceName }
    }))
  );
  const sorted = sortArticles(deduped, sortEl.value);
  renderList(sorted, {
    title: "收藏清單",
    subtitle: `共 ${sorted.length} 則（依 ${sortEl.value === "new" ? "最新→最舊" : "最舊→最新"} 排序）`
  });
}

// -----------------------------
// 主流程：搜尋
// -----------------------------
async function runSearch(query, opts = {}) {
  const label = opts.label || query;

  showFavOnly = false;
  toggleFavEl.textContent = "收藏清單";

  if (!query || !String(query).trim()) return;

  setStatus("讀取中…");
  setLoading(true);

  try {
    const raw = await fetchArticles(query, 30);
    const deduped = dedupeByTitle(raw);
    const sorted = sortArticles(deduped, sortEl.value);

    renderList(sorted, {
      title: `搜尋結果：${label}`,
      subtitle: `共 ${sorted.length} 則（已去重；無 description 已隱藏）`
    });

    setStatus("完成");
  } catch (e) {
    listEl.innerHTML = "";
    const err = document.createElement("div");
    err.className = "sub";
    err.textContent = `讀取失敗：${e.message}`;
    listEl.appendChild(err);
    setStatus("失敗");
  } finally {
    setLoading(false);
  }
}

// -----------------------------
// 初始化：焦點新聞 + 快捷鍵 + 事件
// -----------------------------
async function initFocus() {
  try {
    usFocusSub.textContent = "載入中…";

    const us = await fetchArticles(US_FOCUS_QUERY, 10);
    const us1 = sortArticles(dedupeByTitle(us), "new")[0];

    renderFocus(usFocusEl, us1);
    usFocusSub.textContent = "最新 1 則";
  } catch (e) {
    usFocusEl.textContent = `載入失敗：${e.message}`;
    usFocusSub.textContent = "";
  }
}

function wireEvents() {
  goEl.onclick = () => runSearch(qEl.value.trim());

  // Enter 鍵也能搜尋
  qEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch(qEl.value.trim());
  });

  sortEl.addEventListener("change", () => {
    if (showFavOnly) {
      renderFavList();
      return;
    }
    const current = qEl.value.trim();
    if (current) runSearch(current);
  });

  toggleFavEl.onclick = () => {
    showFavOnly = !showFavOnly;
    if (showFavOnly) {
      toggleFavEl.textContent = "回到搜尋";
      renderFavList();
      setStatus("收藏");
      return;
    }
    toggleFavEl.textContent = "收藏清單";
    const current = qEl.value.trim();
    if (current) runSearch(current);
    else {
      listEl.innerHTML = "";
      resultTitleEl.textContent = "搜尋結果";
      resultSubEl.textContent = "";
      setStatus("就緒");
    }
  };
}

function initButtons() {
  makeButtons(usSectorsEl, US_SECTORS, { prefix: "美股｜" });
  makeButtons(usCompaniesEl, US_COMPANIES, { prefix: "美股｜" });
}

(async function init() {
  setStatus("就緒");
  initButtons();
  wireEvents();
  await initFocus();
})();

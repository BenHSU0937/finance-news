// ⚠️ 這裡一定要是你的 Cloudflare Worker 網址（不要加尾巴 /api）
// 例："https://square-poetry-154f.xxxxx.workers.dev"
const API_BASE = "https://square-poetry-154f.benbenben0937267.workers.dev";

// ===== DOM =====
const qEl = document.getElementById("q");
const goEl = document.getElementById("go");
const clearEl = document.getElementById("clear");
const listEl = document.getElementById("list");
const msgEl = document.getElementById("msg");
const loadingEl = document.getElementById("loading");
const resultPanel = document.getElementById("resultPanel");
const sortEl = document.getElementById("sort");
const countEl = document.getElementById("count");
const dedupEl = document.getElementById("dedup");
const themeBtn = document.getElementById("themeBtn");
const showFavBtn = document.getElementById("showFav");

const focusBox = document.getElementById("focusBox");
const focusStatus = document.getElementById("focusStatus");

const industryChips = document.getElementById("industryChips");
const companyChips = document.getElementById("companyChips");

// ===== 設定 =====
const FAV_KEY = "finance_news_favs_v1"; // localStorage key
const THEME_KEY = "finance_news_theme_v1";

// 美股大盤焦點：你可以隨時改成你習慣看的關鍵字
const US_FOCUS_QUERY = "S&P 500 OR Nasdaq OR Dow Jones OR Fed rate OR CPI OR earnings";

// 產業快捷鍵（你提的分類）
const US_INDUSTRIES = [
  { label: "科技業", q: "AI OR semiconductor OR Nvidia OR Apple OR Microsoft OR cloud" },
  { label: "通訊業", q: "telecom OR 5G OR broadband OR T-Mobile OR Verizon" },
  { label: "消費業", q: "consumer discretionary OR retail OR Walmart OR Amazon OR Tesla" },
  { label: "金融業", q: "banks OR JPMorgan OR Goldman OR Fed OR yields" },
  { label: "醫療保健業", q: "healthcare OR pharma OR biotech OR FDA" },
  { label: "工業/國防/航太", q: "defense OR aerospace OR Boeing OR Lockheed OR RTX" },
  { label: "能源/原物料", q: "oil OR energy OR OPEC OR natural gas OR commodities" },
];

// 重要公司（可自己增減）
const US_COMPANIES = [
  { label: "AAPL", q: "Apple" },
  { label: "MSFT", q: "Microsoft" },
  { label: "NVDA", q: "Nvidia" },
  { label: "GOOGL", q: "Google OR Alphabet" },
  { label: "AMZN", q: "Amazon" },
  { label: "META", q: "Meta" },
  { label: "TSLA", q: "Tesla" },
  { label: "JPM", q: "JPMorgan" },
  { label: "XOM", q: "Exxon" },
  { label: "LLY", q: "Eli Lilly" },
];

// ===== state =====
let lastArticles = [];
let lastDedupRemoved = 0;

// ===== utils =====
function showMsg(text) {
  msgEl.textContent = text;
  msgEl.style.display = text ? "block" : "none";
}
function setLoading(on) {
  loadingEl.style.display = on ? "flex" : "none";
}

function parseTime(s) {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function sortArticles(arr, mode) {
  const copy = [...arr];
  copy.sort((a, b) => {
    const ta = parseTime(a.publishedAt);
    const tb = parseTime(b.publishedAt);
    return mode === "old" ? ta - tb : tb - ta;
  });
  return copy;
}

function dedupeByTitle(arr) {
  const seen = new Set();
  const out = [];
  let removed = 0;

  for (const a of arr) {
    const title = (a.title || "").trim().toLowerCase();
    if (!title) continue;
    if (seen.has(title)) {
      removed++;
      continue;
    }
    seen.add(title);
    out.push(a);
  }
  lastDedupRemoved = removed;
  return out;
}

function fmtMeta(a) {
  const src = a?.source?.name || "Unknown";
  const t = a.publishedAt ? new Date(a.publishedAt).toLocaleString() : "";
  return `${src}${t ? " · " + t : ""}`;
}

// ===== favorites =====
function loadFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveFavs(list) {
  localStorage.setItem(FAV_KEY, JSON.stringify(list));
}
function isFav(url) {
  const favs = loadFavs();
  return favs.includes(url);
}
function toggleFav(url) {
  const favs = loadFavs();
  const idx = favs.indexOf(url);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.unshift(url);
  saveFavs(favs);
}

// ===== render =====
function renderList(articles) {
  listEl.innerHTML = "";

  countEl.textContent = `${articles.length} 則`;
  dedupEl.textContent = `去重：${lastDedupRemoved}`;

  if (!articles.length) {
    listEl.innerHTML = `<div class="hint">沒有結果。你可以試試：NVDA / Fed rate / earnings / CPI</div>`;
    return;
  }

  for (const a of articles) {
    // 沒 description 的就隱藏（要求）
    const desc = (a.description || "").trim();
    const url = a.url || "";
    const favOn = url && isFav(url);

    const card = document.createElement("div");
    card.className = "card";

    const title = document.createElement("h3");
    title.className = "title";
    title.innerHTML = url
      ? `<a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(a.title || "(No title)")}</a>`
      : escapeHtml(a.title || "(No title)");

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = fmtMeta(a);

    card.appendChild(title);
    card.appendChild(meta);

    if (desc) {
      const d = document.createElement("div");
      d.className = "desc";
      d.textContent = desc;
      card.appendChild(d);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const favWrap = document.createElement("div");
    favWrap.className = "fav";

    const favBtn = document.createElement("button");
    favBtn.className = favOn ? "on" : "";
    favBtn.textContent = favOn ? "★ 已收藏" : "☆ 收藏";
    favBtn.onclick = () => {
      if (!url) return;
      toggleFav(url);
      renderList(sortArticles(dedupeByTitle(lastArticles), sortEl.value));
    };

    favWrap.appendChild(favBtn);
    actions.appendChild(favWrap);

    card.appendChild(actions);
    listEl.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== API =====
async function fetchArticles(query, pageSize = 12) {
  const url = `${API_BASE}/api/articles?q=${encodeURIComponent(query)}&pageSize=${pageSize}`;

  const res = await fetch(url, { method: "GET" });
  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // 兼容：你的 Worker 目前可能是 { status:"ok", articles:[...] } 或直接回 articles
  const articles = data?.articles || [];
  return articles;
}

// ===== actions =====
async function doSearch(query, { scroll = true } = {}) {
  const keyword = (query || "").trim();
  if (!keyword) return;

  showMsg("");
  setLoading(true);

  try {
    const raw = await fetchArticles(keyword, 18);
    lastArticles = raw;

    const cleaned = dedupeByTitle(raw);
    const sorted = sortArticles(cleaned, sortEl.value);

    renderList(sorted);

    if (scroll) {
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (e) {
    showMsg(`搜尋失敗：${e.message}`);
    listEl.innerHTML = "";
    countEl.textContent = "0 則";
    dedupEl.textContent = "去重：0";
  } finally {
    setLoading(false);
  }
}

async function loadFocus() {
  focusStatus.textContent = "載入中…";
  focusBox.innerHTML = "";
  try {
    const raw = await fetchArticles(US_FOCUS_QUERY, 6);
    const cleaned = sortArticles(dedupeByTitle(raw), "new").slice(0, 2);

    if (!cleaned.length) {
      focusStatus.textContent = "無資料";
      focusBox.innerHTML = `<div class="hint">目前沒有抓到焦點新聞。</div>`;
      return;
    }

    focusStatus.textContent = "已更新";
    for (const a of cleaned) {
      const desc = (a.description || "").trim();
      const url = a.url || "";

      const card = document.createElement("div");
      card.className = "card";

      const title = document.createElement("h3");
      title.className = "title";
      title.innerHTML = url
        ? `<a href="${url}" target="_blank" rel="noreferrer">${escapeHtml(a.title || "(No title)")}</a>`
        : escapeHtml(a.title || "(No title)");

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = fmtMeta(a);

      card.appendChild(title);
      card.appendChild(meta);

      // 焦點區我也照你規則：沒 description 就不顯示
      if (desc) {
        const d = document.createElement("div");
        d.className = "desc";
        d.textContent = desc;
        card.appendChild(d);
      }

      const actions = document.createElement("div");
      actions.className = "actions";

      if (url) {
        const favBtn = document.createElement("button");
        const favOn = isFav(url);
        favBtn.className = favOn ? "on" : "";
        favBtn.textContent = favOn ? "★ 已收藏" : "☆ 收藏";
        favBtn.onclick = () => {
          toggleFav(url);
          loadFocus(); // 刷新焦點區收藏狀態
        };
        actions.appendChild(favBtn);
      }

      card.appendChild(actions);
      focusBox.appendChild(card);
    }
  } catch (e) {
    focusStatus.textContent = "失敗";
    focusBox.innerHTML = `<div class="error">焦點載入失敗：${escapeHtml(e.message)}</div>`;
  }
}

function renderChips() {
  // industries
  industryChips.innerHTML = "";
  for (const it of US_INDUSTRIES) {
    const el = document.createElement("div");
    el.className = "chip";
    el.innerHTML = `<span>${escapeHtml(it.label)}</span>`;
    el.onclick = () => {
      qEl.value = it.label; // 給使用者視覺提示
      doSearch(it.q);
    };
    industryChips.appendChild(el);
  }

  // companies
  companyChips.innerHTML = "";
  for (const it of US_COMPANIES) {
    const el = document.createElement("div");
    el.className = "chip";
    el.innerHTML = `<b>${escapeHtml(it.label)}</b><span>${escapeHtml(it.q.split(" OR ")[0])}</span>`;
    el.onclick = () => {
      qEl.value = it.label;
      doSearch(it.q);
    };
    companyChips.appendChild(el);
  }
}

// ===== theme =====
function getTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}
function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
themeBtn.onclick = () => {
  const now = document.body.getAttribute("data-theme") || "dark";
  setTheme(now === "dark" ? "light" : "dark");
};

// ===== events =====
goEl.onclick = () => doSearch(qEl.value);

qEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch(qEl.value);
});

sortEl.addEventListener("change", () => {
  const cleaned = dedupeByTitle(lastArticles || []);
  renderList(sortArticles(cleaned, sortEl.value));
});

clearEl.onclick = () => {
  qEl.value = "";
  showMsg("");
  listEl.innerHTML = "";
  countEl.textContent = "0 則";
  dedupEl.textContent = "去重：0";
};

showFavBtn.onclick = () => {
  const favs = loadFavs();
  if (!favs.length) {
    showMsg("你目前沒有收藏。");
    listEl.innerHTML = "";
    countEl.textContent = "0 則";
    dedupEl.textContent = "去重：0";
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // 收藏顯示：用網址當基準，盡量保留你之前抓到的文章內容；
  // 如果 lastArticles 沒有，就用一個「最小卡片」呈現
  showMsg("");
  const minimal = favs.map((url) => ({
    title: url,
    url,
    description: "",
    publishedAt: "",
    source: { name: "Saved" },
  }));

  lastArticles = minimal;
  lastDedupRemoved = 0;
  renderList(sortArticles(minimal, "new"));
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
};

// ===== init =====
setTheme(getTheme());
renderChips();
loadFocus();

// 預設給一個你每天會用的初始查詢（可刪）
doSearch("Nvidia OR Fed rate OR earnings", { scroll: false });

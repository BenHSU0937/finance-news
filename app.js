// ⚠️ 這裡一定要是你的 Cloudflare Worker 網址
const API_BASE = "https://square-poetry-154f.benbenben0937267.workers.dev";

const q = document.getElementById("q");
const go = document.getElementById("go");
const list = document.getElementById("list");

go.onclick = async () => {
  const keyword = q.value.trim();
  if (!keyword) return;

  list.innerHTML = "讀取中…";

  try {
    const url = `${API_BASE}/api/articles?q=${encodeURIComponent(keyword)}&pageSize=10`;
    const res = await fetch(url);
    const data = await res.json();

    list.innerHTML = "";

    for (const a of data.articles || []) {
      const d = document.createElement("div");
      d.className = "card";
      d.innerHTML = `
        <a href="${a.url}" target="_blank">${a.title}</a>
        <div class="meta">${a.source?.name || ""} · ${a.publishedAt || ""}</div>
        <p>${a.description || ""}</p>
      `;
      list.appendChild(d);
    }
  } catch (err) {
    list.innerHTML = "發生錯誤，請稍後再試";
  }
};

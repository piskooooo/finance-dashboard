const state = {
  holdings: [],
  selectedSymbol: null,
  market: null
};

const elements = {
  form: document.querySelector("#holdingForm"),
  holdingsList: document.querySelector("#holdingsList"),
  holdingCount: document.querySelector("#holdingCount"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedSummary: document.querySelector("#selectedSummary"),
  lastPrice: document.querySelector("#lastPrice"),
  quoteMeta: document.querySelector("#quoteMeta"),
  dayChange: document.querySelector("#dayChange"),
  weekChange: document.querySelector("#weekChange"),
  sharesHeld: document.querySelector("#sharesHeld"),
  positionValue: document.querySelector("#positionValue"),
  priceChart: document.querySelector("#priceChart"),
  chartCaption: document.querySelector("#chartCaption"),
  newsList: document.querySelector("#newsList"),
  newsCaption: document.querySelector("#newsCaption"),
  refreshButton: document.querySelector("#refreshButton"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate")
};

function currency(value) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function number(value) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function percent(value) {
  if (!Number.isFinite(value)) return "--";
  const formatted = `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  return formatted;
}

function setSignedMetric(element, value) {
  element.textContent = percent(value);
  element.classList.toggle("positive", Number.isFinite(value) && value >= 0);
  element.classList.toggle("negative", Number.isFinite(value) && value < 0);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function activeHolding() {
  return state.holdings.find((holding) => holding.symbol === state.selectedSymbol) || null;
}

function renderHoldings() {
  elements.holdingsList.innerHTML = "";
  elements.holdingCount.textContent = state.holdings.length
    ? `${state.holdings.length} stock${state.holdings.length === 1 ? "" : "s"}`
    : "No stocks yet";

  if (!state.holdings.length) {
    elements.holdingsList.append(elements.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  for (const holding of state.holdings) {
    const row = document.createElement("div");
    row.className = `holding-row${holding.symbol === state.selectedSymbol ? " active" : ""}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "holding-select";
    button.innerHTML = `<strong>${holding.symbol}</strong><span>${holding.name || `${number(holding.shares)} shares`}</span>`;
    button.addEventListener("click", () => selectHolding(holding.symbol));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      await api(`/api/holdings/${encodeURIComponent(holding.symbol)}`, { method: "DELETE" });
      await loadHoldings();
    });

    row.append(button, remove);
    elements.holdingsList.append(row);
  }
}

function renderEmptyMarket(message = "Select a holding to load market data.") {
  elements.selectedTitle.textContent = state.selectedSymbol || "Add a holding to begin";
  elements.selectedSummary.textContent = message;
  elements.lastPrice.textContent = "--";
  elements.quoteMeta.textContent = "No quote loaded";
  setSignedMetric(elements.dayChange, null);
  setSignedMetric(elements.weekChange, null);
  elements.sharesHeld.textContent = activeHolding() ? number(activeHolding().shares) : "--";
  elements.positionValue.textContent = "--";
  elements.chartCaption.textContent = "Price history unavailable.";
  elements.priceChart.innerHTML = "";
  elements.newsCaption.textContent = "No articles loaded.";
  elements.newsList.innerHTML = "";
}

function renderChart(history) {
  elements.priceChart.innerHTML = "";
  if (!history?.length) {
    elements.chartCaption.textContent = "Price history unavailable.";
    return;
  }

  const width = 640;
  const height = 220;
  const pad = 18;
  const closes = history.map((row) => row.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const points = history.map((row, index) => {
    const x = pad + (index / Math.max(history.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((row.close - min) / span) * (height - pad * 2);
    return [x, y];
  });

  const line = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${points.at(-1)[0].toFixed(1)} ${height - pad} L ${points[0][0].toFixed(1)} ${height - pad} Z`;
  const axis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  axis.setAttribute("class", "chart-axis");
  axis.setAttribute("x1", pad);
  axis.setAttribute("x2", width - pad);
  axis.setAttribute("y1", height - pad);
  axis.setAttribute("y2", height - pad);

  const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  areaPath.setAttribute("class", "chart-area");
  areaPath.setAttribute("d", area);

  const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  linePath.setAttribute("class", "chart-line");
  linePath.setAttribute("d", line);

  elements.priceChart.append(areaPath, axis, linePath);
  elements.chartCaption.textContent = `${history[0].date} to ${history.at(-1).date}`;
}

function renderNews(news) {
  elements.newsList.innerHTML = "";
  elements.newsCaption.textContent = news?.length ? `${news.length} recent articles` : "No articles returned.";

  if (!news?.length) {
    const empty = elements.emptyStateTemplate.content.cloneNode(true);
    empty.querySelector("strong").textContent = "No news found";
    empty.querySelector("span").textContent = "Try refreshing later or confirm the ticker symbol.";
    elements.newsList.append(empty);
    return;
  }

  for (const article of news) {
    const link = document.createElement("a");
    link.className = "news-item";
    link.href = article.link;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<strong>${article.title}</strong><span class="news-meta">${article.source || "Yahoo Finance"}${article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleString()}` : ""}</span>`;
    elements.newsList.append(link);
  }
}

function renderMarket() {
  const holding = activeHolding();
  if (!holding || !state.market) return renderEmptyMarket();

  const { quote, summary, history, news, errors } = state.market;
  elements.selectedTitle.textContent = `${holding.symbol}${holding.name ? ` · ${holding.name}` : ""}`;
  elements.selectedSummary.textContent = summary?.text || errors?.[0] || "Market data could not be loaded.";
  elements.lastPrice.textContent = quote?.price ? currency(quote.price) : "--";
  elements.quoteMeta.textContent = quote ? `${quote.source} · ${quote.date} ${quote.time || ""}`.trim() : "Quote unavailable";
  setSignedMetric(elements.dayChange, summary?.dayChange);
  setSignedMetric(elements.weekChange, summary?.weekChange);
  elements.sharesHeld.textContent = number(holding.shares);
  elements.positionValue.textContent = quote?.price && holding.shares ? currency(quote.price * holding.shares) : "--";
  renderChart(history);
  renderNews(news);
}

async function selectHolding(symbol, force = false) {
  state.selectedSymbol = symbol;
  state.market = null;
  renderHoldings();
  renderEmptyMarket("Loading market performance and related articles...");
  try {
    const cacheBust = force ? `?t=${Date.now()}` : "";
    state.market = await api(`/api/market/${encodeURIComponent(symbol)}${cacheBust}`);
    renderMarket();
  } catch (error) {
    renderEmptyMarket(error.message);
  }
}

async function loadHoldings() {
  state.holdings = await api("/api/holdings");
  if (!state.holdings.some((holding) => holding.symbol === state.selectedSymbol)) {
    state.selectedSymbol = state.holdings[0]?.symbol || null;
  }
  renderHoldings();
  if (state.selectedSymbol) await selectHolding(state.selectedSymbol);
  else renderEmptyMarket();
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const payload = Object.fromEntries(formData.entries());
  await api("/api/holdings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  elements.form.reset();
  state.selectedSymbol = payload.symbol.toUpperCase();
  await loadHoldings();
});

elements.refreshButton.addEventListener("click", () => {
  if (state.selectedSymbol) selectHolding(state.selectedSymbol, true);
});

loadHoldings().catch((error) => {
  renderEmptyMarket(error.message);
});

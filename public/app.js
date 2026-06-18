const categories = [
  { id: "dashboard", label: "Dashboard", tracked: false },
  { id: "stocks", label: "Stocks", singular: "stock", tracked: true, units: "Shares" },
  { id: "crypto", label: "Crypto", singular: "crypto asset", tracked: true, units: "Coins / tokens" },
  { id: "commodities", label: "Commodities", singular: "commodity", tracked: true, units: "Units" },
  { id: "alts", label: "Alt investments", singular: "alt investment", tracked: false, units: "Items" },
  { id: "credit", label: "Credit", singular: "credit account", tracked: false, debt: true, units: "Accounts" },
  { id: "loans", label: "Loans", singular: "loan", tracked: false, debt: true, units: "Loans" },
  { id: "cash", label: "Cash", singular: "cash account", tracked: false, units: "Accounts" }
];

const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category]));

const state = {
  holdings: [],
  markets: new Map(),
  activeTab: "dashboard",
  selectedId: null,
  lookupTimer: null
};

const elements = {
  tabs: document.querySelector("#assetTabs"),
  dashboardView: document.querySelector("#dashboardView"),
  assetView: document.querySelector("#assetView"),
  form: document.querySelector("#holdingForm"),
  formTitle: document.querySelector("#formTitle"),
  formHint: document.querySelector("#formHint"),
  symbolField: document.querySelector("#symbolField"),
  symbolInput: document.querySelector('[name="symbol"]'),
  nameInput: document.querySelector('[name="name"]'),
  exchangeInput: document.querySelector('[name="exchange"]'),
  quoteTypeInput: document.querySelector('[name="quoteType"]'),
  categoryInput: document.querySelector('[name="category"]'),
  symbolResults: document.querySelector("#symbolResults"),
  quantityMode: document.querySelector("#quantityMode"),
  unitsModeLabel: document.querySelector("#unitsModeLabel"),
  unitsField: document.querySelector("#unitsField"),
  amountField: document.querySelector("#amountField"),
  unitsLabel: document.querySelector("#unitsLabel"),
  unitsInput: document.querySelector('[name="units"]'),
  amountInput: document.querySelector('[name="amount"]'),
  holdingsList: document.querySelector("#holdingsList"),
  holdingCount: document.querySelector("#holdingCount"),
  listTitle: document.querySelector("#listTitle"),
  selectedEyebrow: document.querySelector("#selectedEyebrow"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedSummary: document.querySelector("#selectedSummary"),
  valueLabel: document.querySelector("#valueLabel"),
  lastPrice: document.querySelector("#lastPrice"),
  quoteMeta: document.querySelector("#quoteMeta"),
  dayChange: document.querySelector("#dayChange"),
  weekChange: document.querySelector("#weekChange"),
  sharesHeld: document.querySelector("#sharesHeld"),
  unitsHeldLabel: document.querySelector("#unitsHeldLabel"),
  positionValue: document.querySelector("#positionValue"),
  priceChart: document.querySelector("#priceChart"),
  chartTitle: document.querySelector("#chartTitle"),
  chartCaption: document.querySelector("#chartCaption"),
  newsTitle: document.querySelector("#newsTitle"),
  newsList: document.querySelector("#newsList"),
  newsCaption: document.querySelector("#newsCaption"),
  refreshButton: document.querySelector("#refreshButton"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
  totalNetWorth: document.querySelector("#totalNetWorth"),
  totalMeta: document.querySelector("#totalMeta"),
  assetTotal: document.querySelector("#assetTotal"),
  debtTotal: document.querySelector("#debtTotal"),
  positionCount: document.querySelector("#positionCount"),
  marketCount: document.querySelector("#marketCount"),
  allocationList: document.querySelector("#allocationList"),
  attentionList: document.querySelector("#attentionList")
};

function currency(value) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function number(value, digits = 8) {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function percent(value) {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
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

function normalizeHolding(holding) {
  const category = categoryMap[holding.category] ? holding.category : "stocks";
  return {
    id: holding.id || `${category}-${holding.symbol || holding.name}`,
    category,
    symbol: holding.symbol || "",
    name: holding.name || "",
    exchange: holding.exchange || "",
    quoteType: holding.quoteType || "",
    trackingType: holding.trackingType || (categoryMap[category]?.tracked && holding.symbol ? "market" : "manual"),
    quantityMode: holding.quantityMode === "value" ? "value" : "units",
    units: Number(holding.units ?? holding.shares ?? 0),
    amount: Number(holding.amount ?? 0),
    totalCost: Number(holding.totalCost ?? holding.avgCost ?? 0),
    notes: holding.notes || ""
  };
}

function activeCategory() {
  return categoryMap[state.activeTab] || categoryMap.stocks;
}

function currentHoldings() {
  return state.holdings.filter((holding) => holding.category === state.activeTab);
}

function activeHolding() {
  return state.holdings.find((holding) => holding.id === state.selectedId) || null;
}

function marketFor(holding) {
  return holding?.symbol ? state.markets.get(holding.symbol) : null;
}

function itemValue(holding) {
  const market = marketFor(holding);
  const price = market?.quote?.price;

  if (holding.quantityMode === "units" && Number.isFinite(price) && holding.units > 0) {
    return holding.units * price;
  }

  if (holding.quantityMode === "value" && holding.amount > 0) return holding.amount;
  if (holding.totalCost > 0) return holding.totalCost;
  if (holding.units > 0 && !Number.isFinite(price)) return null;
  return 0;
}

function itemCost(holding) {
  if (holding.totalCost > 0) return holding.totalCost;
  if (holding.quantityMode === "value" && holding.amount > 0) return holding.amount;
  return null;
}

function signedValue(holding) {
  const value = itemValue(holding);
  if (!Number.isFinite(value)) return null;
  return categoryMap[holding.category]?.debt ? -Math.abs(value) : value;
}

function renderTabs() {
  elements.tabs.innerHTML = "";
  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button${state.activeTab === category.id ? " active" : ""}`;
    button.textContent = category.label;
    button.addEventListener("click", () => setTab(category.id));
    elements.tabs.append(button);
  }
}

function renderDashboard() {
  const rows = state.holdings.map((holding) => ({ holding, value: signedValue(holding) }));
  const assets = rows.filter((row) => Number.isFinite(row.value) && row.value > 0).reduce((sum, row) => sum + row.value, 0);
  const debts = rows.filter((row) => Number.isFinite(row.value) && row.value < 0).reduce((sum, row) => sum + Math.abs(row.value), 0);
  const net = assets - debts;
  const marketItems = state.holdings.filter((holding) => holding.trackingType === "market").length;

  elements.totalNetWorth.textContent = currency(net);
  elements.assetTotal.textContent = currency(assets);
  elements.debtTotal.textContent = currency(debts);
  elements.positionCount.textContent = number(state.holdings.length, 0);
  elements.marketCount.textContent = number(marketItems, 0);
  elements.totalMeta.textContent = `${state.holdings.length} total item${state.holdings.length === 1 ? "" : "s"}`;

  renderAllocation();
  renderAttention();
}

function renderAllocation() {
  elements.allocationList.innerHTML = "";
  const groups = categories
    .filter((category) => category.id !== "dashboard")
    .map((category) => {
      const holdings = state.holdings.filter((holding) => holding.category === category.id);
      const total = holdings.reduce((sum, holding) => sum + Math.abs(signedValue(holding) || 0), 0);
      return { category, total, count: holdings.length };
    })
    .filter((group) => group.count || group.total);

  if (!groups.length) {
    elements.allocationList.append(emptyState("No tracked values yet", "Add items from the tabs above."));
    return;
  }

  const max = Math.max(...groups.map((group) => group.total), 1);
  for (const group of groups) {
    const row = document.createElement("div");
    row.className = "allocation-row";
    row.innerHTML = `
      <div>
        <strong>${group.category.label}</strong>
        <span>${group.count} item${group.count === 1 ? "" : "s"}</span>
      </div>
      <div class="allocation-value">
        <strong>${currency(group.total)}</strong>
        <span style="--bar:${Math.max((group.total / max) * 100, 3)}%"></span>
      </div>
    `;
    elements.allocationList.append(row);
  }
}

function renderAttention() {
  elements.attentionList.innerHTML = "";
  const needs = state.holdings.filter((holding) => !Number.isFinite(itemValue(holding)) || itemValue(holding) === 0).slice(0, 6);
  if (!needs.length) {
    elements.attentionList.append(emptyState("Nothing obvious missing", "Every saved item has at least a rough value."));
    return;
  }

  for (const holding of needs) {
    const row = document.createElement("div");
    row.className = "news-item";
    row.innerHTML = `<strong>${holding.symbol || holding.name}</strong><span class="news-meta">${categoryMap[holding.category].label} needs a value or quote.</span>`;
    elements.attentionList.append(row);
  }
}

function emptyState(title, text) {
  const empty = elements.emptyStateTemplate.content.cloneNode(true);
  empty.querySelector("strong").textContent = title;
  empty.querySelector("span").textContent = text;
  return empty;
}

function renderAssetForm() {
  const category = activeCategory();
  const isTracked = category.tracked;
  elements.formTitle.textContent = `Add ${category.singular}`;
  elements.formHint.textContent = isTracked
    ? "Type a ticker and pick a Yahoo Finance match to autofill name/details."
    : "Enter the value manually for private assets, credit, loans, or cash.";
  elements.categoryInput.value = category.id;
  elements.symbolField.classList.toggle("hidden", !isTracked);
  elements.symbolInput.required = isTracked;
  elements.unitsLabel.textContent = category.units;
  elements.unitsModeLabel.textContent = category.units;
  elements.unitsHeldLabel.textContent = category.units;
  elements.listTitle.textContent = category.label;
  elements.selectedEyebrow.textContent = `Selected ${category.singular}`;
  elements.valueLabel.textContent = category.debt ? "Balance" : "Estimated value";
  elements.chartTitle.textContent = isTracked ? "30-day price line" : "Manual value";
  elements.newsTitle.textContent = isTracked ? "Related news" : "Notes";
}

function renderQuantityMode() {
  const mode = new FormData(elements.form).get("quantityMode") || "units";
  elements.unitsField.classList.toggle("hidden", mode !== "units");
  elements.amountField.classList.toggle("hidden", mode !== "value");
}

function renderHoldings() {
  const category = activeCategory();
  const holdings = currentHoldings();
  elements.holdingsList.innerHTML = "";
  elements.holdingCount.textContent = holdings.length
    ? `${holdings.length} item${holdings.length === 1 ? "" : "s"}`
    : `No ${category.label.toLowerCase()} yet`;

  if (!holdings.length) {
    elements.holdingsList.append(emptyState(`No ${category.label.toLowerCase()} yet`, "Add the first one above."));
    return;
  }

  for (const holding of holdings) {
    const row = document.createElement("div");
    row.className = `holding-row${holding.id === state.selectedId ? " active" : ""}`;
    const label = holding.symbol || holding.name;
    const value = signedValue(holding);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "holding-select";
    button.innerHTML = `<strong>${label}</strong><span>${holding.name && holding.symbol ? holding.name : currency(Math.abs(value || 0))}</span>`;
    button.addEventListener("click", () => selectHolding(holding.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      await api(`/api/holdings/${encodeURIComponent(holding.id)}`, { method: "DELETE" });
      await loadHoldings();
    });

    row.append(button, remove);
    elements.holdingsList.append(row);
  }
}

function renderEmptyMarket(message = "Select an item to view details.") {
  const holding = activeHolding();
  elements.selectedTitle.textContent = holding ? holding.symbol || holding.name : "Add an item to begin";
  elements.selectedSummary.textContent = message;
  elements.lastPrice.textContent = holding ? currency(Math.abs(signedValue(holding) || 0)) : "--";
  elements.quoteMeta.textContent = holding?.trackingType === "market" ? "No quote loaded" : "Manual value";
  setSignedMetric(elements.dayChange, null);
  setSignedMetric(elements.weekChange, null);
  elements.sharesHeld.textContent = holding ? holding.quantityMode === "units" ? number(holding.units) : currency(holding.amount) : "--";
  elements.positionValue.textContent = holding ? currency(Math.abs(signedValue(holding) || 0)) : "--";
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
    elements.newsList.append(emptyState("No news found", "Try refreshing later or confirm the ticker symbol."));
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

function renderManualDetails(holding) {
  const cost = itemCost(holding);
  elements.selectedTitle.textContent = holding.name || holding.symbol;
  elements.selectedSummary.textContent = holding.notes || `${categoryMap[holding.category].label} item tracked manually.`;
  elements.lastPrice.textContent = currency(Math.abs(signedValue(holding) || 0));
  elements.quoteMeta.textContent = cost ? `Cost basis: ${currency(cost)}` : "Manual entry";
  setSignedMetric(elements.dayChange, null);
  setSignedMetric(elements.weekChange, null);
  elements.sharesHeld.textContent = holding.quantityMode === "units" ? number(holding.units) : currency(holding.amount);
  elements.positionValue.textContent = currency(Math.abs(signedValue(holding) || 0));
  elements.priceChart.innerHTML = "";
  elements.chartCaption.textContent = holding.notes ? "Notes shown on the right." : "No market chart for manual items.";
  elements.newsCaption.textContent = "Manual item notes";
  elements.newsList.innerHTML = "";
  elements.newsList.append(emptyState("Manual tracking", holding.notes || "Add notes to describe valuation, appraisals, payoff plans, or account details."));
}

function renderMarket() {
  const holding = activeHolding();
  if (!holding) return renderEmptyMarket();
  if (holding.trackingType !== "market") return renderManualDetails(holding);

  const market = marketFor(holding);
  if (!market) return renderEmptyMarket("Loading market performance and related articles...");

  const { quote, summary, history, news, errors } = market;
  const value = itemValue(holding);
  elements.selectedTitle.textContent = `${holding.symbol}${holding.name ? ` · ${holding.name}` : ""}`;
  elements.selectedSummary.textContent = summary?.text || errors?.[0] || "Market data could not be loaded.";
  elements.lastPrice.textContent = quote?.price ? currency(quote.price) : currency(value || 0);
  elements.quoteMeta.textContent = quote ? `${quote.source} · ${quote.date} ${quote.time || ""}`.trim() : "Quote unavailable";
  setSignedMetric(elements.dayChange, summary?.dayChange);
  setSignedMetric(elements.weekChange, summary?.weekChange);
  elements.sharesHeld.textContent = holding.quantityMode === "units" ? number(holding.units) : currency(holding.amount);
  elements.positionValue.textContent = Number.isFinite(value) ? currency(value) : "--";
  renderChart(history);
  renderNews(news);
}

async function loadMarketFor(holding, force = false) {
  if (!holding?.symbol || holding.trackingType !== "market") return;
  if (!force && state.markets.has(holding.symbol)) return;
  const cacheBust = force ? `?t=${Date.now()}` : "";
  const market = await api(`/api/market/${encodeURIComponent(holding.symbol)}${cacheBust}`);
  state.markets.set(holding.symbol, market);
}

async function selectHolding(id, force = false) {
  state.selectedId = id;
  renderHoldings();
  renderMarket();
  const holding = activeHolding();
  try {
    await loadMarketFor(holding, force);
    renderHoldings();
    renderDashboard();
    renderMarket();
  } catch (error) {
    renderEmptyMarket(error.message);
  }
}

function setTab(tab) {
  const changedTabs = state.activeTab !== tab;
  state.activeTab = tab;
  renderTabs();
  elements.dashboardView.classList.toggle("hidden", tab !== "dashboard");
  elements.assetView.classList.toggle("hidden", tab === "dashboard");

  if (tab === "dashboard") {
    renderDashboard();
    return;
  }

  renderAssetForm();
  if (changedTabs) {
    elements.form.reset();
    elements.categoryInput.value = tab;
    elements.exchangeInput.value = "";
    elements.quoteTypeInput.value = "";
    elements.symbolResults.hidden = true;
    renderQuantityMode();
  }
  const holdings = currentHoldings();
  if (!holdings.some((holding) => holding.id === state.selectedId)) state.selectedId = holdings[0]?.id || null;
  renderHoldings();
  if (state.selectedId) selectHolding(state.selectedId);
  else renderEmptyMarket();
}

async function lookupSymbols(query) {
  if (!query || query.length < 1 || !activeCategory().tracked) {
    elements.symbolResults.hidden = true;
    return;
  }

  try {
    const results = await api(`/api/search?q=${encodeURIComponent(query)}`);
    elements.symbolResults.innerHTML = "";
    if (!results.length) {
      elements.symbolResults.hidden = true;
      return;
    }

    for (const result of results) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "symbol-result";
      button.innerHTML = `<strong>${result.symbol}</strong><span>${result.name} · ${result.exchange || result.type}</span>`;
      button.addEventListener("click", () => {
        elements.symbolInput.value = result.symbol;
        elements.nameInput.value = result.name;
        elements.exchangeInput.value = result.exchange || "";
        elements.quoteTypeInput.value = result.quoteType || "";
        elements.symbolResults.hidden = true;
      });
      elements.symbolResults.append(button);
    }
    elements.symbolResults.hidden = false;
  } catch {
    elements.symbolResults.hidden = true;
  }
}

async function loadHoldings() {
  state.holdings = (await api("/api/holdings")).map(normalizeHolding);
  await Promise.allSettled(state.holdings.filter((holding) => holding.trackingType === "market").slice(0, 8).map((holding) => loadMarketFor(holding)));
  renderTabs();
  setTab(state.activeTab);
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const payload = Object.fromEntries(formData.entries());
  payload.symbol = (payload.symbol || "").toUpperCase();
  await api("/api/holdings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  elements.form.reset();
  elements.categoryInput.value = state.activeTab;
  elements.exchangeInput.value = "";
  elements.quoteTypeInput.value = "";
  renderQuantityMode();
  await loadHoldings();
  const created = state.holdings.find((holding) => holding.category === state.activeTab && (holding.symbol === payload.symbol || holding.name === payload.name));
  if (created) await selectHolding(created.id);
});

elements.quantityMode.addEventListener("change", renderQuantityMode);

elements.symbolInput.addEventListener("input", (event) => {
  window.clearTimeout(state.lookupTimer);
  state.lookupTimer = window.setTimeout(() => lookupSymbols(event.target.value.trim()), 250);
});

elements.refreshButton.addEventListener("click", async () => {
  if (state.activeTab === "dashboard") {
    await Promise.allSettled(state.holdings.filter((holding) => holding.trackingType === "market").map((holding) => loadMarketFor(holding, true)));
    renderDashboard();
  } else if (state.selectedId) {
    await selectHolding(state.selectedId, true);
  }
});

renderTabs();
renderQuantityMode();
loadHoldings().catch((error) => {
  elements.dashboardView.classList.remove("hidden");
  elements.assetView.classList.add("hidden");
  elements.totalNetWorth.textContent = "--";
  elements.totalMeta.textContent = error.message;
});

const categories = [
  { id: "dashboard", label: "Dashboard", tracked: false },
  { id: "stocks", label: "Stocks", singular: "stock", tracked: true, units: "Shares" },
  { id: "crypto", label: "Crypto", singular: "crypto asset", tracked: true, units: "Coins / tokens" },
  { id: "commodities", label: "Commodities", singular: "commodity", tracked: true, units: "Units" },
  { id: "alts", label: "Alt investments", singular: "alt investment", tracked: false, units: "Items" },
  { id: "credit", label: "Credit", singular: "card", tracked: false, debt: true, units: "Cards" },
  { id: "loans", label: "Loans", singular: "loan", tracked: false, debt: true, units: "Loans" },
  { id: "cash", label: "Cash", singular: "cash account", tracked: false, units: "Accounts" }
];

const chartRanges = [
  { id: "24h", label: "24H" },
  { id: "5d", label: "5D" },
  { id: "1m", label: "1M" },
  { id: "ytd", label: "YTD" },
  { id: "1y", label: "1Y" },
  { id: "5y", label: "5Y" },
  { id: "all", label: "All" }
];

const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category]));

const state = {
  holdings: [],
  markets: new Map(),
  activeTab: "dashboard",
  selectedId: null,
  lookupTimer: null,
  chartRange: "24h"
};

const marketEvents = [
  { date: "2026-06-19", title: "Market closed: Juneteenth", type: "Market holiday" },
  { date: "2026-07-03", title: "Market closed: Independence Day observed", type: "Market holiday" },
  { date: "2026-07-28", title: "FOMC meeting begins", type: "Federal Reserve" },
  { date: "2026-07-29", title: "FOMC rate decision", type: "Federal Reserve" },
  { date: "2026-09-15", title: "FOMC meeting begins", type: "Federal Reserve" },
  { date: "2026-09-16", title: "FOMC rate decision", type: "Federal Reserve" },
  { date: "2026-10-27", title: "FOMC meeting begins", type: "Federal Reserve" },
  { date: "2026-10-28", title: "FOMC rate decision", type: "Federal Reserve" },
  { date: "2026-11-26", title: "Market closed: Thanksgiving", type: "Market holiday" },
  { date: "2026-11-27", title: "Market early close", type: "Market holiday" },
  { date: "2026-12-08", title: "FOMC meeting begins", type: "Federal Reserve" },
  { date: "2026-12-09", title: "FOMC rate decision", type: "Federal Reserve" },
  { date: "2026-12-24", title: "Market early close", type: "Market holiday" },
  { date: "2026-12-25", title: "Market closed: Christmas", type: "Market holiday" }
];

const elements = {
  tabs: document.querySelector("#assetTabs"),
  sectionEyebrow: document.querySelector("#sectionEyebrow"),
  sectionTitle: document.querySelector("#sectionTitle"),
  dashboardView: document.querySelector("#dashboardView"),
  assetView: document.querySelector("#assetView"),
  form: document.querySelector("#holdingForm"),
  idInput: document.querySelector('[name="id"]'),
  formTitle: document.querySelector("#formTitle"),
  formHint: document.querySelector("#formHint"),
  symbolField: document.querySelector("#symbolField"),
  symbolInput: document.querySelector('[name="symbol"]'),
  nameField: document.querySelector("#nameField"),
  nameLabel: document.querySelector("#nameLabel"),
  nameInput: document.querySelector('[name="name"]'),
  exchangeInput: document.querySelector('[name="exchange"]'),
  quoteTypeInput: document.querySelector('[name="quoteType"]'),
  categoryInput: document.querySelector('[name="category"]'),
  symbolResults: document.querySelector("#symbolResults"),
  quantityMode: document.querySelector("#quantityMode"),
  unitsModeLabel: document.querySelector("#unitsModeLabel"),
  amountModeLabel: document.querySelector("#amountModeLabel"),
  unitsField: document.querySelector("#unitsField"),
  amountField: document.querySelector("#amountField"),
  amountLabel: document.querySelector("#amountLabel"),
  unitsLabel: document.querySelector("#unitsLabel"),
  unitsInput: document.querySelector('[name="units"]'),
  amountInput: document.querySelector('[name="amount"]'),
  costBasisMode: document.querySelector("#costBasisMode"),
  costPerUnitField: document.querySelector("#costPerUnitField"),
  costPerUnitLabel: document.querySelector("#costPerUnitLabel"),
  costTotalField: document.querySelector("#costTotalField"),
  costTotalLabel: document.querySelector("#costTotalLabel"),
  cashFields: document.querySelector("#cashFields"),
  creditFields: document.querySelector("#creditFields"),
  loanFields: document.querySelector("#loanFields"),
  altFields: document.querySelector("#altFields"),
  saveButton: document.querySelector("#saveButton"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  holdingsList: document.querySelector("#holdingsList"),
  holdingCount: document.querySelector("#holdingCount"),
  listTitle: document.querySelector("#listTitle"),
  selectedEyebrow: document.querySelector("#selectedEyebrow"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedSummary: document.querySelector("#selectedSummary"),
  valueLabel: document.querySelector("#valueLabel"),
  lastPrice: document.querySelector("#lastPrice"),
  quoteMeta: document.querySelector("#quoteMeta"),
  metricOneLabel: document.querySelector("#metricOneLabel"),
  metricTwoLabel: document.querySelector("#metricTwoLabel"),
  dayChange: document.querySelector("#dayChange"),
  weekChange: document.querySelector("#weekChange"),
  sharesHeld: document.querySelector("#sharesHeld"),
  unitsHeldLabel: document.querySelector("#unitsHeldLabel"),
  positionValue: document.querySelector("#positionValue"),
  positionValueLabel: document.querySelector("#positionValueLabel"),
  marketDetails: document.querySelector("#marketDetails"),
  manualDetails: document.querySelector("#manualDetails"),
  manualTitle: document.querySelector("#manualTitle"),
  manualCaption: document.querySelector("#manualCaption"),
  manualList: document.querySelector("#manualList"),
  priceChart: document.querySelector("#priceChart"),
  chartTitle: document.querySelector("#chartTitle"),
  chartCaption: document.querySelector("#chartCaption"),
  rangeControls: document.querySelector("#rangeControls"),
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
  budgetMinimum: document.querySelector("#budgetMinimum"),
  budgetList: document.querySelector("#budgetList"),
  allocationList: document.querySelector("#allocationList"),
  allocationChart: document.querySelector("#allocationChart"),
  categoryPie: document.querySelector("#categoryPie"),
  attentionList: document.querySelector("#attentionList"),
  marketCalendar: document.querySelector("#marketCalendar"),
  upcomingEvents: document.querySelector("#upcomingEvents")
};

function currency(value, code = "USD") {
  if (!Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code || "USD" }).format(value);
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
    costBasisMode: holding.costBasisMode === "total" ? "total" : "perUnit",
    costPerUnit: Number(holding.costPerUnit ?? holding.avgCost ?? 0),
    totalCost: Number(holding.totalCost ?? 0),
    currency: holding.currency || "USD",
    institution: holding.institution || "",
    accountUse: holding.accountUse || "",
    accountType: holding.accountType || "",
    apy: Number(holding.apy || 0),
    cardType: holding.cardType || "",
    minimumPayment: Number(holding.minimumPayment || 0),
    loanType: holding.loanType || "",
    paymentAmount: Number(holding.paymentAmount || 0),
    paymentsLeft: Number(holding.paymentsLeft || 0),
    nextDueDate: holding.nextDueDate || "",
    altType: holding.altType || "",
    accountLocation: holding.accountLocation || "",
    tags: holding.tags || "",
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

function marketKey(symbol, range = state.chartRange) {
  return `${symbol}:${range}`;
}

function marketFor(holding) {
  return holding?.symbol ? state.markets.get(marketKey(holding.symbol)) : null;
}

function itemValue(holding) {
  const market = marketFor(holding);
  const price = market?.quote?.price;

  if (holding.quantityMode === "units" && Number.isFinite(price) && holding.units > 0) return holding.units * price;
  if (holding.quantityMode === "value" && holding.amount > 0) return holding.amount;
  if (!categoryMap[holding.category]?.tracked && holding.amount > 0) return holding.amount;
  if (holding.totalCost > 0) return holding.totalCost;
  if (holding.costPerUnit > 0 && holding.units > 0) return holding.costPerUnit * holding.units;
  if (holding.units > 0 && !Number.isFinite(price)) return null;
  return 0;
}

function itemCost(holding) {
  if (holding.costBasisMode === "perUnit" && holding.costPerUnit > 0 && holding.units > 0) return holding.costPerUnit * holding.units;
  if (holding.totalCost > 0) return holding.totalCost;
  if (holding.quantityMode === "value" && holding.amount > 0) return holding.amount;
  return null;
}

function signedValue(holding) {
  const value = itemValue(holding);
  if (!Number.isFinite(value)) return null;
  return categoryMap[holding.category]?.debt ? -Math.abs(value) : value;
}

function debtPayment(holding) {
  if (holding.category === "credit") return creditEstimate(holding).minimum;
  if (holding.category === "loans") return holding.paymentAmount > 0 ? holding.paymentAmount : 0;
  return 0;
}

function emptyState(title, text) {
  const empty = elements.emptyStateTemplate.content.cloneNode(true);
  empty.querySelector("strong").textContent = title;
  empty.querySelector("span").textContent = text;
  return empty;
}

function piePath(cx, cy, r, start, end) {
  const startX = cx + r * Math.cos(start);
  const startY = cy + r * Math.sin(start);
  const endX = cx + r * Math.cos(end);
  const endY = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${large} 1 ${endX} ${endY} Z`;
}

function renderPie(svg, rows) {
  svg.innerHTML = "";
  const cleanRows = rows.filter((row) => Number.isFinite(row.value) && row.value > 0);
  const total = cleanRows.reduce((sum, row) => sum + row.value, 0);
  if (!total) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "110");
    text.setAttribute("y", "112");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "pie-empty");
    text.textContent = "No values";
    svg.append(text);
    return;
  }

  const colors = ["var(--brand)", "var(--brand-strong)", "#d5d8d6", "#9da4a0", "#686f6b", "var(--negative)", "#7ca7d8"];
  if (cleanRows.length === 1) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "110");
    circle.setAttribute("cy", "110");
    circle.setAttribute("r", "92");
    circle.setAttribute("fill", colors[0]);
    circle.setAttribute("stroke", "#080a09");
    circle.setAttribute("stroke-width", "2");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${cleanRows[0].label}: ${currency(cleanRows[0].value)}`;
    circle.append(title);
    svg.append(circle);
    return;
  }

  let angle = -Math.PI / 2;
  cleanRows.forEach((row, index) => {
    const next = angle + (row.value / total) * Math.PI * 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", piePath(110, 110, 92, angle, next));
    path.setAttribute("fill", colors[index % colors.length]);
    path.setAttribute("stroke", "#080a09");
    path.setAttribute("stroke-width", "2");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${row.label}: ${currency(row.value)}`;
    path.append(title);
    svg.append(path);
    angle = next;
  });
}

function isMarketClosed(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return "Weekend";
  const iso = date.toISOString().slice(0, 10);
  const event = marketEvents.find((item) => item.date === iso && item.title.includes("closed"));
  return event?.title.replace("Market closed: ", "") || "";
}

function renderCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const monthName = first.toLocaleString("en-US", { month: "long", year: "numeric" });
  const cells = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push("<span></span>");
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const iso = date.toISOString().slice(0, 10);
    const closed = isMarketClosed(date);
    const events = marketEvents.filter((event) => event.date === iso);
    const isToday = date.toDateString() === today.toDateString();
    cells.push(`<button type="button" class="calendar-day${closed ? " closed" : ""}${events.length ? " has-event" : ""}${isToday ? " today" : ""}" title="${closed || events.map((event) => event.title).join(", ")}"><strong>${day}</strong><span>${isToday ? "Today" : closed ? "Closed" : events[0]?.type || ""}</span></button>`);
  }
  elements.marketCalendar.innerHTML = `<div class="calendar-title">${monthName}</div><div class="calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="calendar-grid">${cells.join("")}</div>`;

  const todayIso = today.toISOString().slice(0, 10);
  const upcoming = marketEvents.filter((event) => event.date >= todayIso).slice(0, 6);
  elements.upcomingEvents.innerHTML = upcoming.map((event) => `<button type="button" class="event-row"><strong>${event.title}</strong><span>${event.type} · ${new Date(`${event.date}T12:00:00`).toLocaleDateString()}</span></button>`).join("");
}

function clearSymbolResults() {
  window.clearTimeout(state.lookupTimer);
  elements.symbolResults.innerHTML = "";
  elements.symbolResults.hidden = true;
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

function renderRangeControls() {
  elements.rangeControls.innerHTML = "";
  for (const range of chartRanges) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `range-button${state.chartRange === range.id ? " active" : ""}`;
    button.textContent = range.label;
    button.addEventListener("click", async () => {
      state.chartRange = range.id;
      renderRangeControls();
      if (state.selectedId) await selectHolding(state.selectedId, true);
    });
    elements.rangeControls.append(button);
  }
}

function renderDashboard() {
  const rows = state.holdings.map((holding) => ({ holding, value: signedValue(holding) }));
  const assets = rows.filter((row) => Number.isFinite(row.value) && row.value > 0).reduce((sum, row) => sum + row.value, 0);
  const debts = rows.filter((row) => Number.isFinite(row.value) && row.value < 0).reduce((sum, row) => sum + Math.abs(row.value), 0);
  const net = assets - debts;
  const marketItems = state.holdings.filter((holding) => holding.trackingType === "market").length;
  const marketRows = state.holdings
    .filter((holding) => holding.trackingType === "market")
    .map((holding) => ({ value: itemValue(holding), change: marketFor(holding)?.summary?.dayChange }))
    .filter((row) => Number.isFinite(row.value) && Number.isFinite(row.change));
  const marketValue = marketRows.reduce((sum, row) => sum + row.value, 0);
  const weightedMove = marketValue ? marketRows.reduce((sum, row) => sum + row.value * row.change, 0) / marketValue : 0;
  document.body.dataset.theme = weightedMove <= -1 ? "red" : weightedMove > 0 ? "green" : "blue";

  elements.totalNetWorth.textContent = currency(net);
  elements.assetTotal.textContent = currency(assets);
  elements.debtTotal.textContent = currency(debts);
  elements.positionCount.textContent = number(state.holdings.length, 0);
  elements.marketCount.textContent = number(marketItems, 0);
  elements.totalMeta.textContent = `${state.holdings.length} total item${state.holdings.length === 1 ? "" : "s"}`;
  renderPie(elements.allocationChart, categories
    .filter((category) => category.id !== "dashboard")
    .map((category) => ({
      label: category.label,
      value: state.holdings
        .filter((holding) => holding.category === category.id)
        .reduce((sum, holding) => sum + Math.abs(signedValue(holding) || 0), 0)
    })));
  renderAllocation();
  renderBudget();
  renderAttention();
  renderCalendar();
}

function renderBudget() {
  const rows = state.holdings
    .filter((holding) => categoryMap[holding.category]?.debt)
    .map((holding) => ({
      holding,
      payment: debtPayment(holding)
    }))
    .filter((row) => Number.isFinite(row.payment) && row.payment > 0);

  const total = rows.reduce((sum, row) => sum + row.payment, 0);
  elements.budgetMinimum.textContent = currency(total);
  elements.budgetList.innerHTML = "";
  if (!rows.length) {
    elements.budgetList.append(emptyState("No payments entered", "Add card minimums or loan payments to calculate this."));
    return;
  }

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "detail-row";
    item.innerHTML = `<span>${row.holding.name || row.holding.symbol}</span><strong>${currency(row.payment, row.holding.currency)}</strong>`;
    elements.budgetList.append(item);
  }
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
    elements.allocationList.append(emptyState("No tracked values yet", "Add items from the sidebar sections."));
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
    const row = document.createElement("button");
    row.type = "button";
    row.className = "news-item";
    row.innerHTML = `<strong>${holding.symbol || holding.name}</strong><span class="news-meta">${categoryMap[holding.category].label} needs a value or quote.</span>`;
    row.addEventListener("click", async () => {
      await setTab(holding.category);
      await selectHolding(holding.id);
    });
    elements.attentionList.append(row);
  }
}

function setFieldVisibility(category) {
  const isTracked = category.tracked;
  const isCash = category.id === "cash";
  const isCredit = category.id === "credit";
  const isLoan = category.id === "loans";
  const isAlt = category.id === "alts";
  const isDebt = category.id === "loans" || isCredit;

  elements.symbolField.classList.toggle("hidden", !isTracked);
  elements.symbolInput.required = isTracked;
  elements.cashFields.classList.toggle("hidden", !isCash);
  elements.creditFields.classList.toggle("hidden", !isCredit);
  elements.loanFields.classList.toggle("hidden", !isLoan);
  elements.altFields.classList.toggle("hidden", !isAlt);
  setGroupEnabled(elements.cashFields, isCash);
  setGroupEnabled(elements.creditFields, isCredit);
  setGroupEnabled(elements.loanFields, isLoan);
  setGroupEnabled(elements.altFields, isAlt);
  elements.quantityMode.classList.toggle("hidden", isCash || isCredit || isLoan);
  elements.costBasisMode.classList.toggle("hidden", !isTracked);
  elements.costPerUnitField.classList.toggle("hidden", !isTracked || new FormData(elements.form).get("costBasisMode") === "total");
  elements.costTotalField.classList.toggle("hidden", isCash || isCredit || isLoan || (isTracked && new FormData(elements.form).get("costBasisMode") !== "total"));
  elements.unitsField.classList.toggle("hidden", isCash || isCredit || isLoan || new FormData(elements.form).get("quantityMode") !== "units");
  elements.amountField.classList.toggle("hidden", isTracked && new FormData(elements.form).get("quantityMode") !== "value");

  elements.amountLabel.textContent = isDebt ? "Total owed" : isCash ? "Current balance" : "Total dollar amount";
  elements.nameLabel.textContent = isCash ? "Account nickname" : isCredit ? "Card name" : category.id === "loans" ? "Loan name" : isAlt ? "Item name" : "Name";
  elements.amountModeLabel.textContent = isDebt ? "Total owed" : "Total dollar amount";
}

function setGroupEnabled(group, enabled) {
  group.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = !enabled;
  });
}

function renderAssetForm() {
  const category = activeCategory();
  elements.sectionEyebrow.textContent = category.label;
  elements.sectionTitle.textContent = category.label;
  elements.formTitle.textContent = `Add ${category.singular}`;
  elements.formHint.textContent = category.tracked
    ? "Type a ticker and pick a Yahoo Finance match to autofill name/details."
    : "Manual entry. Add as many accounts or items as you need.";
  elements.categoryInput.value = category.id;
  elements.unitsLabel.textContent = category.units;
  elements.unitsModeLabel.textContent = category.units;
  elements.unitsHeldLabel.textContent = category.units;
  elements.listTitle.textContent = category.label;
  elements.selectedEyebrow.textContent = `Selected ${category.singular}`;
  elements.valueLabel.textContent = category.debt ? "Balance owed" : "Estimated value";
  elements.costPerUnitLabel.textContent = category.id === "stocks" ? "Cost basis per share" : "Cost basis per unit";
  elements.metricOneLabel.textContent = category.tracked ? "Daily move" : category.id === "credit" ? "Minimum payment" : "Type";
  elements.metricTwoLabel.textContent = category.tracked ? "Range move" : category.id === "credit" ? "Payoff time" : "Currency / APR";
  elements.positionValueLabel.textContent = category.debt ? "Balance" : "Value";
  setFieldVisibility(category);
}

function renderQuantityMode() {
  setFieldVisibility(activeCategory());
}

function setFormValue(name, value) {
  const field = elements.form.elements[name];
  if (!field) return;
  field.value = value ?? "";
}

function populateForm(holding) {
  if (holding.category !== state.activeTab) return;
  elements.idInput.value = holding.id;
  setFormValue("symbol", holding.symbol);
  setFormValue("name", holding.name);
  setFormValue("exchange", holding.exchange);
  setFormValue("quoteType", holding.quoteType);
  setFormValue("quantityMode", holding.quantityMode);
  setFormValue("units", holding.units || "");
  setFormValue("amount", holding.amount || "");
  setFormValue("costBasisMode", holding.costBasisMode);
  setFormValue("costPerUnit", holding.costPerUnit || "");
  setFormValue("totalCost", holding.totalCost || "");
  setFormValue("currency", holding.currency || "USD");
  setFormValue("institution", holding.institution);
  setFormValue("accountUse", holding.accountUse || "personal");
  setFormValue("accountType", holding.accountType || "checking");
  setFormValue("apy", holding.apy || "");
  setFormValue("loanApy", holding.apy || "");
  setFormValue("cardType", holding.cardType || "credit");
  setFormValue("minimumPayment", holding.minimumPayment || "");
  setFormValue("loanType", holding.loanType || "auto");
  setFormValue("paymentAmount", holding.paymentAmount || "");
  setFormValue("paymentsLeft", holding.paymentsLeft || "");
  setFormValue("nextDueDate", holding.nextDueDate);
  setFormValue("altType", holding.altType);
  setFormValue("accountLocation", holding.accountLocation);
  setFormValue("tags", holding.tags);
  setFormValue("notes", holding.notes);
  elements.saveButton.textContent = "Update item";
  clearSymbolResults();
  renderQuantityMode();
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderHoldings() {
  const category = activeCategory();
  const holdings = currentHoldings();
  elements.holdingsList.innerHTML = "";
  elements.holdingCount.textContent = holdings.length ? `${holdings.length} item${holdings.length === 1 ? "" : "s"}` : `No ${category.label.toLowerCase()} yet`;
  elements.clearSelectionButton.disabled = !state.selectedId;
  elements.clearSelectionButton.textContent = state.selectedId ? "View all" : "Viewing all";

  if (!holdings.length) {
    renderPie(elements.categoryPie, []);
    elements.holdingsList.append(emptyState(`No ${category.label.toLowerCase()} yet`, "Add the first one above."));
    return;
  }

  renderPie(elements.categoryPie, holdings.map((holding) => ({
    label: holding.symbol || holding.name,
    value: Math.abs(signedValue(holding) || 0)
  })));

  for (const holding of holdings) {
    const row = document.createElement("div");
    row.className = `holding-row${holding.id === state.selectedId ? " active" : ""}`;
    const label = holding.symbol || holding.name;
    const value = signedValue(holding);
    const sub = holding.category === "cash" && holding.institution
      ? `${holding.institution} · ${holding.accountType || "account"}`
      : holding.name && holding.symbol ? holding.name : currency(Math.abs(value || 0), holding.currency);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "holding-select";
    button.innerHTML = `<strong>${label}</strong><span>${sub}</span>`;
    button.addEventListener("click", () => selectHolding(holding.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      await api(`/api/holdings/${encodeURIComponent(holding.id)}`, { method: "DELETE" });
      await loadHoldings();
    });

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary compact";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => populateForm(holding));

    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(edit, remove);

    row.append(button, actions);
    elements.holdingsList.append(row);
  }
}

function resetDetailPanels(showMarket) {
  elements.marketDetails.classList.toggle("hidden", !showMarket);
  elements.manualDetails.classList.toggle("hidden", showMarket);
}

function renderEmptyMarket(message = "Select an item to view details.") {
  const holding = activeHolding();
  resetDetailPanels(Boolean(holding?.trackingType === "market"));
  elements.selectedTitle.textContent = holding ? holding.symbol || holding.name : "Add an item to begin";
  elements.selectedSummary.textContent = message;
  elements.lastPrice.textContent = holding ? currency(Math.abs(signedValue(holding) || 0), holding.currency) : "--";
  elements.quoteMeta.textContent = holding?.trackingType === "market" ? "No quote loaded" : "Manual value";
  setSignedMetric(elements.dayChange, null);
  setSignedMetric(elements.weekChange, null);
  elements.sharesHeld.textContent = holding ? holding.quantityMode === "units" ? number(holding.units) : currency(holding.amount, holding.currency) : "--";
  elements.positionValue.textContent = holding ? currency(Math.abs(signedValue(holding) || 0), holding.currency) : "--";
  elements.chartCaption.textContent = "Price history unavailable.";
  elements.priceChart.innerHTML = "";
  elements.newsCaption.textContent = "No articles loaded.";
  elements.newsList.innerHTML = "";
}

function renderCategoryOverview() {
  const category = activeCategory();
  const holdings = currentHoldings();
  const total = holdings.reduce((sum, holding) => sum + Math.abs(signedValue(holding) || 0), 0);
  const cost = holdings.reduce((sum, holding) => sum + (itemCost(holding) || 0), 0);
  const debts = category.debt;
  resetDetailPanels(false);
  elements.selectedEyebrow.textContent = `${category.label} overview`;
  elements.selectedTitle.textContent = holdings.length ? `All ${category.label.toLowerCase()}` : `No ${category.label.toLowerCase()} yet`;
  elements.selectedSummary.textContent = holdings.length
    ? `Combined ${category.label.toLowerCase()} view across ${holdings.length} item${holdings.length === 1 ? "" : "s"}.`
    : "Add an item from the form to start tracking this section.";
  elements.valueLabel.textContent = debts ? "Total owed" : "Total value";
  elements.lastPrice.textContent = currency(total);
  elements.quoteMeta.textContent = holdings.length ? "Combined category total" : "No saved items";
  elements.metricOneLabel.textContent = debts ? "Monthly minimum" : "Items";
  elements.metricTwoLabel.textContent = "Cost basis";
  elements.unitsHeldLabel.textContent = "Tracked";
  elements.positionValueLabel.textContent = debts ? "Debt total" : "Value total";
  elements.dayChange.classList.remove("positive", "negative");
  elements.weekChange.classList.remove("positive", "negative");
  elements.dayChange.textContent = debts ? currency(holdings.reduce((sum, holding) => sum + debtPayment(holding), 0)) : number(holdings.length, 0);
  elements.weekChange.textContent = cost ? currency(cost) : "--";
  elements.sharesHeld.textContent = number(holdings.length, 0);
  elements.positionValue.textContent = currency(total);
  elements.manualTitle.textContent = `${category.label} breakdown`;
  elements.manualCaption.textContent = "Select an individual item when you want item-level performance, notes, or news.";
  elements.manualList.innerHTML = holdings.length
    ? holdings.map((holding) => detailRow(holding.symbol || holding.name, currency(Math.abs(signedValue(holding) || 0), holding.currency))).join("")
    : "";
  if (!holdings.length) elements.manualList.append(emptyState("Nothing here yet", "Use the form to add the first item."));
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
  const items = news || [];
  elements.newsList.innerHTML = "";
  elements.newsCaption.textContent = items.length ? `${items.length} recent articles` : "No articles returned.";
  if (!items.length) {
    elements.newsList.append(emptyState("No news found", "Try refreshing later or confirm the ticker symbol."));
    return;
  }

  const addArticle = (article, extra = false) => {
    const link = document.createElement("a");
    link.className = `news-item${extra ? " extra-news hidden" : ""}`;
    link.href = article.link;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<strong>${article.title}</strong><span class="news-meta">${article.source || "Yahoo Finance"}${article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleString()}` : ""}</span>`;
    elements.newsList.append(link);
  };

  items.forEach((article, index) => addArticle(article, index >= 2));
  if (items.length > 2) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "secondary";
    more.textContent = `Show ${items.length - 2} more`;
    more.addEventListener("click", () => {
      elements.newsList.querySelectorAll(".extra-news").forEach((node) => node.classList.remove("hidden"));
      more.remove();
    });
    elements.newsList.append(more);
  }
}

function creditEstimate(holding) {
  const balance = Math.abs(itemValue(holding) || 0);
  const apr = Math.max(holding.apy || 0, 0);
  if (!balance) return { minimum: 0, months: 0, interest: 0 };
  if (holding.cardType === "charge") return { minimum: balance, months: 1, interest: 0 };
  const monthlyRate = apr / 100 / 12;
  const minimum = holding.minimumPayment > 0 ? holding.minimumPayment : Math.max(balance * 0.03, 25, balance * monthlyRate + balance * 0.01);
  if (apr > 0 && minimum <= balance * monthlyRate) return { minimum, months: Infinity, interest: Infinity };
  if (apr === 0) return { minimum, months: Math.ceil(balance / minimum), interest: 0 };
  let current = balance;
  let months = 0;
  let interest = 0;
  while (current > 0.01 && months < 600) {
    const charge = current * monthlyRate;
    interest += charge;
    current = current + charge - Math.min(minimum, current + charge);
    months += 1;
  }
  return { minimum, months, interest };
}

function detailRow(label, value) {
  return `<div class="detail-row"><span>${label}</span><strong>${value || "--"}</strong></div>`;
}

function renderManualDetails(holding) {
  const category = categoryMap[holding.category];
  const value = Math.abs(signedValue(holding) || 0);
  resetDetailPanels(false);
  elements.selectedTitle.textContent = holding.name || holding.symbol;
  elements.selectedSummary.textContent = holding.notes || `${category.label} item tracked manually.`;
  elements.lastPrice.textContent = currency(value, holding.currency);
  elements.quoteMeta.textContent = category.debt ? "Manual debt balance" : "Manual entry";
  elements.dayChange.classList.remove("positive", "negative");
  elements.weekChange.classList.remove("positive", "negative");
  elements.sharesHeld.textContent = holding.quantityMode === "units" ? number(holding.units) : currency(holding.amount, holding.currency);
  elements.positionValue.textContent = currency(value, holding.currency);

  let rows = [];
  if (holding.category === "cash") {
    elements.dayChange.textContent = holding.accountType || "--";
    elements.weekChange.textContent = holding.currency || "USD";
    rows = [
      detailRow("Bank / institution", holding.institution),
      detailRow("Account type", holding.accountType),
      detailRow("Personal / business", holding.accountUse),
      detailRow("Currency", holding.currency),
      detailRow("Balance", currency(value, holding.currency)),
      detailRow("Location / account", holding.accountLocation),
      detailRow("Tags", holding.tags)
    ];
  } else if (holding.category === "credit") {
    const estimate = creditEstimate(holding);
    elements.dayChange.textContent = currency(estimate.minimum, holding.currency);
    elements.weekChange.textContent = estimate.months === Infinity ? "No payoff" : estimate.months ? `${estimate.months} mo` : "--";
    rows = [
      detailRow("Card type", holding.cardType === "charge" ? "Charge card" : "Credit card"),
      detailRow("APR", `${number(holding.apy, 2)}%`),
      detailRow("Estimated minimum", currency(estimate.minimum, holding.currency)),
      detailRow("Minimum-only payoff", estimate.months === Infinity ? "Minimum is below monthly interest" : estimate.months ? `${estimate.months} months` : "--"),
      detailRow("Estimated interest", estimate.interest === Infinity ? "Balance will grow" : currency(estimate.interest, holding.currency)),
      detailRow("Location / account", holding.accountLocation),
      detailRow("Tags", holding.tags)
    ];
  } else if (holding.category === "loans") {
    elements.dayChange.textContent = holding.loanType || "--";
    elements.weekChange.textContent = holding.apy ? `${number(holding.apy, 2)}%` : "--";
    rows = [
      detailRow("Loan type", holding.loanType),
      detailRow("Balance", currency(value, holding.currency)),
      detailRow("APR", holding.apy ? `${number(holding.apy, 2)}%` : "--"),
      detailRow("Payment amount", holding.paymentAmount ? currency(holding.paymentAmount, holding.currency) : "--"),
      detailRow("Payments left", holding.paymentsLeft ? number(holding.paymentsLeft, 0) : "--"),
      detailRow("Next due date", holding.nextDueDate),
      detailRow("Location / account", holding.accountLocation),
      detailRow("Tags", holding.tags)
    ];
  } else {
    const cost = itemCost(holding);
    elements.dayChange.textContent = holding.accountType || "--";
    elements.weekChange.textContent = holding.apy ? `${number(holding.apy, 2)}%` : holding.currency || "USD";
    rows = [
      detailRow("Category", category.label),
      detailRow("Type", holding.altType),
      detailRow("Value", currency(value, holding.currency)),
      detailRow("Cost basis", cost ? currency(cost, holding.currency) : "--"),
      detailRow("Location / account", holding.accountLocation),
      detailRow("Tags", holding.tags),
      detailRow("Notes", holding.notes)
    ];
  }

  elements.manualTitle.textContent = `${category.label} details`;
  elements.manualCaption.textContent = "Manual entry. No market chart is shown for this section.";
  elements.manualList.innerHTML = rows.join("");
}

function renderMarket() {
  const holding = activeHolding();
  if (!holding) return renderCategoryOverview();
  if (holding.trackingType !== "market") return renderManualDetails(holding);
  resetDetailPanels(true);
  renderRangeControls();

  const market = marketFor(holding);
  if (!market) return renderEmptyMarket("Loading market performance and related articles...");

  const { quote, summary, history, news, errors } = market;
  const value = itemValue(holding);
  const cost = itemCost(holding);
  elements.selectedTitle.textContent = `${holding.symbol}${holding.name ? ` · ${holding.name}` : ""}`;
  elements.selectedSummary.textContent = summary?.text || errors?.[0] || "Market data could not be loaded.";
  elements.lastPrice.textContent = quote?.price ? currency(quote.price) : currency(value || 0);
  elements.quoteMeta.textContent = quote ? `${quote.source} · ${quote.date} ${quote.time || ""}`.trim() : "Quote unavailable";
  setSignedMetric(elements.dayChange, summary?.dayChange);
  setSignedMetric(elements.weekChange, summary?.weekChange);
  elements.metricTwoLabel.textContent = `${chartRanges.find((range) => range.id === state.chartRange)?.label || "Range"} move`;
  elements.sharesHeld.textContent = holding.quantityMode === "units" ? number(holding.units) : currency(holding.amount);
  elements.positionValue.textContent = Number.isFinite(value) ? currency(value) : "--";
  elements.chartTitle.textContent = `${holding.symbol} price`;
  elements.newsTitle.textContent = `${holding.symbol} news`;
  renderChart(history);
  renderNews(news);
  if (cost) elements.quoteMeta.textContent += ` · Cost basis ${currency(cost)}`;
}

async function loadMarketFor(holding, force = false) {
  if (!holding?.symbol || holding.trackingType !== "market") return;
  const key = marketKey(holding.symbol);
  if (!force && state.markets.has(key)) return;
  const params = new URLSearchParams({ range: state.chartRange });
  if (force) params.set("t", Date.now());
  const market = await api(`/api/market/${encodeURIComponent(holding.symbol)}?${params.toString()}`);
  state.markets.set(key, market);
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

function clearSelection() {
  state.selectedId = null;
  renderHoldings();
  renderCategoryOverview();
}

async function refreshActiveTab() {
  if (state.activeTab === "dashboard") {
    await Promise.allSettled(state.holdings.filter((holding) => holding.trackingType === "market").slice(0, 8).map((holding) => loadMarketFor(holding, true)));
    renderDashboard();
  } else if (state.selectedId) {
    await selectHolding(state.selectedId, true);
  } else {
    renderCategoryOverview();
  }
}

function resetFormForTab(tab) {
  elements.form.reset();
  elements.idInput.value = "";
  elements.saveButton.textContent = "Save item";
  elements.categoryInput.value = tab;
  elements.exchangeInput.value = "";
  elements.quoteTypeInput.value = "";
  clearSymbolResults();
  renderQuantityMode();
}

async function setTab(tab) {
  const changedTabs = state.activeTab !== tab;
  state.activeTab = tab;
  renderTabs();
  const category = activeCategory();
  elements.sectionEyebrow.textContent = tab === "dashboard" ? "Main dashboard" : category.label;
  elements.sectionTitle.textContent = category.label;
  elements.dashboardView.classList.toggle("hidden", tab !== "dashboard");
  elements.assetView.classList.toggle("hidden", tab === "dashboard");
  clearSymbolResults();

  if (tab === "dashboard") {
    renderDashboard();
    if (changedTabs) await refreshActiveTab();
    return;
  }

  renderAssetForm();
  if (changedTabs) resetFormForTab(tab);
  const holdings = currentHoldings();
  if (changedTabs || !holdings.some((holding) => holding.id === state.selectedId)) state.selectedId = null;
  renderHoldings();
  if (state.selectedId) await selectHolding(state.selectedId, changedTabs && category.tracked);
  else renderCategoryOverview();
}

async function fillCurrentPriceBasis(symbol) {
  if (!symbol) return;
  try {
    const market = await api(`/api/market/${encodeURIComponent(symbol)}?range=24h`);
    const price = market?.quote?.price;
    if (!Number.isFinite(price) || price <= 0) return;
    setFormValue("costBasisMode", "perUnit");
    setFormValue("costPerUnit", price.toFixed(price >= 1 ? 2 : 8));
    state.markets.set(marketKey(symbol), market);
    renderQuantityMode();
  } catch {
    // Price prefill is a convenience; symbol selection should still succeed if quotes are unavailable.
  }
}

async function lookupSymbols(query) {
  if (!query || query.length < 1 || !activeCategory().tracked) {
    clearSymbolResults();
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
      button.addEventListener("click", async () => {
        elements.symbolInput.value = result.symbol;
        elements.nameInput.value = result.name;
        elements.exchangeInput.value = result.exchange || "";
        elements.quoteTypeInput.value = result.quoteType || "";
        clearSymbolResults();
        await fillCurrentPriceBasis(result.symbol);
      });
      elements.symbolResults.append(button);
    }
    elements.symbolResults.hidden = false;
  } catch {
    clearSymbolResults();
  }
}

async function loadHoldings() {
  state.holdings = (await api("/api/holdings")).map(normalizeHolding);
  await Promise.allSettled(state.holdings.filter((holding) => holding.trackingType === "market").slice(0, 8).map((holding) => loadMarketFor(holding)));
  renderTabs();
  await setTab(state.activeTab);
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const payload = Object.fromEntries(formData.entries());
  payload.symbol = (payload.symbol || "").toUpperCase();
  if (["cash", "credit", "loans"].includes(state.activeTab)) payload.quantityMode = "value";
  await api("/api/holdings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  resetFormForTab(state.activeTab);
  await loadHoldings();
  const created = state.holdings.find((holding) => holding.category === state.activeTab && (holding.symbol === payload.symbol || holding.name === payload.name));
  if (created) await selectHolding(created.id, true);
});

elements.quantityMode.addEventListener("change", renderQuantityMode);
elements.costBasisMode.addEventListener("change", renderQuantityMode);

elements.symbolInput.addEventListener("input", (event) => {
  window.clearTimeout(state.lookupTimer);
  state.lookupTimer = window.setTimeout(() => lookupSymbols(event.target.value.trim()), 250);
});

document.addEventListener("click", (event) => {
  if (!elements.symbolResults.contains(event.target) && event.target !== elements.symbolInput) clearSymbolResults();
});

elements.refreshButton.addEventListener("click", refreshActiveTab);
elements.clearSelectionButton.addEventListener("click", clearSelection);

renderTabs();
renderRangeControls();
renderQuantityMode();
loadHoldings().catch((error) => {
  elements.dashboardView.classList.remove("hidden");
  elements.assetView.classList.add("hidden");
  elements.totalNetWorth.textContent = "--";
  elements.totalMeta.textContent = error.message;
});

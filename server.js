const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");
const ExcelJS = require("exceljs");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const HOLDINGS_FILE = path.join(DATA_DIR, "holdings.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15 * 60 * 1000);
const SESSION_COOKIE = "finance_session";
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 14);

const marketCache = new Map();
const searchCache = new Map();
const sessions = new Map();

const TRACKED_CATEGORIES = new Set(["stocks", "crypto", "commodities"]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(HOLDINGS_FILE);
  } catch {
    await fs.writeFile(HOLDINGS_FILE, "[]\n");
  }
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, "[]\n");
  }
}

function userDataDir(user) {
  return path.join(DATA_DIR, "users", user.id);
}

function userHoldingsFile(user) {
  return path.join(userDataDir(user), "holdings.json");
}

async function ensureUserStorage(user) {
  await fs.mkdir(userDataDir(user), { recursive: true });
  try {
    await fs.access(userHoldingsFile(user));
  } catch {
    await fs.writeFile(userHoldingsFile(user), "[]\n");
  }
}

async function readUsers() {
  await ensureStorage();
  const raw = await fs.readFile(USERS_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeUsers(users) {
  await ensureStorage();
  await fs.writeFile(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`);
}

async function resetAllAccounts() {
  sessions.clear();
  await fs.rm(path.join(DATA_DIR, "users"), { recursive: true, force: true });
  await writeUsers([]);
}

async function readHoldings(user) {
  await ensureUserStorage(user);
  const raw = await fs.readFile(userHoldingsFile(user), "utf8");
  return JSON.parse(raw);
}

async function writeHoldings(user, holdings) {
  await ensureUserStorage(user);
  await fs.writeFile(userHoldingsFile(user), `${JSON.stringify(holdings, null, 2)}\n`);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const err = new Error("Request body must be valid JSON.");
    err.status = 400;
    throw err;
  }
}

async function readRawBody(req, maxBytes = 20 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const err = new Error("Uploaded file is too large.");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function cleanSymbol(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, "");
}

function cleanUsername(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.@_-]/g, "")
    .slice(0, 64);
}

function legacyCleanUsername(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(":")[1];
  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(candidate, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index < 0 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
}

function publicUser(user) {
  return { id: user.id, username: user.username };
}

function findUserByUsername(users, input) {
  const username = cleanUsername(input);
  const legacyUsername = legacyCleanUsername(input);
  return users.find((item) => item.username === username || item.username === legacyUsername);
}

function makeSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function clearExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

async function currentUser(req) {
  clearExpiredSessions();
  const token = parseCookies(req)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session) return null;
  const users = await readUsers();
  const user = users.find((item) => item.id === session.userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return user;
}

async function requireUser(req) {
  const user = await currentUser(req);
  if (user) return user;
  const err = new Error("Login required.");
  err.status = 401;
  throw err;
}

async function migrateLegacyHoldings(user) {
  await ensureUserStorage(user);
  const destination = userHoldingsFile(user);
  const current = JSON.parse(await fs.readFile(destination, "utf8"));
  if (Array.isArray(current) && current.length) return;

  try {
    const legacy = JSON.parse(await fs.readFile(HOLDINGS_FILE, "utf8"));
    if (Array.isArray(legacy) && legacy.length) {
      await fs.writeFile(destination, `${JSON.stringify(legacy.map(normalizeHoldingRecord), null, 2)}\n`);
    }
  } catch {
    // No legacy file to migrate.
  }
}

function cleanCategory(input) {
  const value = String(input || "stocks").trim().toLowerCase();
  return ["stocks", "crypto", "commodities", "alts", "properties", "credit", "loans", "cash", "income", "expenses"].includes(value) ? value : "stocks";
}

function makeId(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeHoldingRecord(input) {
  const category = cleanCategory(input.category);
  const symbol = cleanSymbol(input.symbol);
  const name = String(input.name || "").trim();
  const quantityMode = input.quantityMode === "value" ? "value" : "units";
  const units = Number(input.units ?? input.shares ?? 0);
  const amount = Number(input.amount ?? 0);
  const totalCost = Number(input.totalCost ?? input.avgCost ?? 0);
  const costPerUnit = Number(input.costPerUnit ?? input.avgCost ?? 0);
  const id = input.id || (symbol ? `${category}-${symbol}` : `${category}-${makeId(name) || "item"}-${Date.now()}`);

  return {
    id,
    category,
    symbol,
    name,
    exchange: String(input.exchange || "").trim(),
    quoteType: String(input.quoteType || "").trim(),
    trackingType: TRACKED_CATEGORIES.has(category) && symbol ? "market" : "manual",
    quantityMode,
    units: Number.isFinite(units) ? units : 0,
    amount: Number.isFinite(amount) ? amount : 0,
    costBasisMode: input.costBasisMode === "total" ? "total" : "perUnit",
    costPerUnit: Number.isFinite(costPerUnit) ? costPerUnit : 0,
    totalCost: Number.isFinite(totalCost) ? totalCost : 0,
    currency: String(input.currency || "USD").trim().toUpperCase(),
    institution: String(input.institution || "").trim(),
    accountUse: String(input.accountUse || "").trim(),
    accountType: String(input.accountType || "").trim(),
    apy: Number(input.apy || input.loanApy || 0),
    cardType: String(input.cardType || "").trim(),
    creditLimit: Number(input.creditLimit || 0),
    minimumPayment: Number(input.minimumPayment || 0),
    annualFee: Number(input.annualFee || 0),
    loanType: String(input.loanType || "").trim(),
    paymentAmount: Number(input.paymentAmount || 0),
    paymentsLeft: Number(input.paymentsLeft || 0),
    nextDueDate: String(input.nextDueDate || "").trim(),
    altType: String(input.altType || "").trim(),
    propertyType: String(input.propertyType || "").trim(),
    propertyValue: Number(input.propertyValue || 0),
    mortgageBalance: Number(input.mortgageBalance || 0),
    incomeType: String(input.incomeType || "").trim(),
    expenseType: String(input.expenseType || "").trim(),
    expenseFrequency: String(input.expenseFrequency || "monthly").trim().toLowerCase(),
    accountLocation: String(input.accountLocation || "").trim(),
    tags: String(input.tags || "").trim(),
    notes: String(input.notes || "").trim(),
    updatedAt: input.updatedAt || new Date().toISOString(),
    createdAt: input.createdAt
  };
}

function normalizeHolding(input) {
  const category = cleanCategory(input.category);
  const symbol = cleanSymbol(input.symbol);
  const name = String(input.name || "").trim();
  if (TRACKED_CATEGORIES.has(category) && !symbol) {
    const err = new Error("A ticker symbol is required.");
    err.status = 400;
    throw err;
  }
  if (!TRACKED_CATEGORIES.has(category) && !name) {
    const err = new Error("A name is required for manually tracked assets.");
    err.status = 400;
    throw err;
  }

  return normalizeHoldingRecord({ ...input, category, symbol, name, updatedAt: new Date().toISOString() });
}

function workbookCell(sheet, address) {
  const value = sheet.getCell(address).value;
  if (value == null) return "";
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "result")) return value.result ?? "";
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
    if (Object.prototype.hasOwnProperty.call(value, "text")) return value.text ?? "";
  }
  return value;
}

function numericCell(sheet, address) {
  const value = Number(workbookCell(sheet, address));
  return Number.isFinite(value) ? value : 0;
}

function expenseTypeForImport(prefix, name) {
  const upper = String(name || "").toUpperCase();
  if (prefix === "SB") return "business";
  if (prefix === "CD") return "debt-payment";
  if (prefix === "SC") return "loan-payment";
  if (upper.includes("INSURANCE")) return "insurance";
  if (upper.includes("TAX")) return "tax";
  if (upper.includes("CAR GAS") || upper.includes("CAR WASH")) return "transportation";
  if (upper.includes("SPOTIFY") || upper.includes("TWITCH") || upper.includes("AMAZON") || upper.includes("SUBSCRIPTION")) return "subscription";
  return "other";
}

function loanTypeForImport(name) {
  const upper = String(name || "").toUpperCase();
  if (upper.includes("CAR")) return "auto";
  if (upper.includes("MORTGAGE")) return "mortgage";
  if (upper.includes("STUDENT")) return "student";
  if (upper.includes("LOAN")) return "personal";
  return "other";
}

function budgetImportExpenseRecord(year, row, rawName, amount) {
  const [rawPrefix, ...rest] = String(rawName || "").split(" - ");
  const prefix = rest.length ? rawPrefix.trim().toUpperCase() : "";
  const name = (rest.length ? rest.join(" - ") : rawName).trim();
  const base = {
    quantityMode: "value",
    currency: "USD",
    tags: `budget-import,${year}${prefix ? `,${prefix.toLowerCase()}` : ""}`,
    notes: `Imported from Budget.xlsx Budget tab row ${row} for the ${year} budget plan.`,
    updatedAt: new Date().toISOString()
  };

  if (prefix === "CD") {
    return {
      ...base,
      id: `budget-${year}-credit-${makeId(name)}`,
      category: "credit",
      name,
      amount: 0,
      cardType: "credit",
      minimumPayment: amount
    };
  }

  if (prefix === "SC") {
    return {
      ...base,
      id: `budget-${year}-loan-${makeId(name)}`,
      category: "loans",
      name,
      amount: 0,
      loanType: loanTypeForImport(name),
      paymentAmount: amount
    };
  }

  return {
    ...base,
    id: `budget-${year}-expense-${makeId(name)}`,
    category: "expenses",
    name,
    amount,
    expenseType: expenseTypeForImport(prefix, name),
    accountUse: prefix === "SB" ? "business" : "personal"
  };
}

function budgetImportIncomeRecords(sheet, year) {
  const blocks = {
    2022: { headerRow: 1, subtotalRow: 14, sourceCols: ["C", "D", "E", "F", "G", "H", "I"] },
    2023: { headerRow: 1, subtotalRow: 14, sourceCols: ["O", "P", "Q", "R", "S", "T", "U"] },
    2024: { headerRow: 15, subtotalRow: 28, sourceCols: ["C", "D", "E", "F", "G", "H", "I"] },
    2025: { headerRow: 15, subtotalRow: 28, sourceCols: ["O", "P", "Q", "R", "S", "T", "U"] },
    2026: { headerRow: 29, subtotalRow: 42, sourceCols: ["C", "D", "E", "F", "G", "H", "I"] },
    2027: { headerRow: 29, subtotalRow: 42, sourceCols: ["O", "P", "Q", "R", "S", "T", "U"] },
    2028: { headerRow: 43, subtotalRow: 56, sourceCols: ["C", "D", "E", "F", "G", "H", "I"] },
    2029: { headerRow: 43, subtotalRow: 56, sourceCols: ["O", "P", "Q", "R", "S", "T", "U"] }
  };
  const block = blocks[year];
  if (!block) return [];

  return block.sourceCols
    .map((col) => {
      const source = String(workbookCell(sheet, `${col}${block.headerRow}`) || "").trim();
      const annual = numericCell(sheet, `${col}${block.subtotalRow}`);
      if (!source || annual <= 0) return null;
      return {
        id: `budget-${year}-income-${makeId(source)}`,
        category: "income",
        name: `${source} (${year} budget)`,
        quantityMode: "value",
        amount: annual / 12,
        currency: "USD",
        incomeType: "1099",
        tags: `budget-import,${year},income`,
        notes: `Imported from Budget.xlsx Budget tab. Planned annual gross for ${year}: ${annual.toFixed(2)}.`,
        updatedAt: new Date().toISOString()
      };
    })
    .filter(Boolean);
}

function budgetImportExpenseRecords(sheet, year) {
  const blocks = {
    2026: { nameCol: "A", amountCol: "B" },
    2027: { nameCol: "I", amountCol: "J" },
    2028: { nameCol: "Q", amountCol: "R" }
  };
  const block = blocks[year];
  if (!block) return [];

  const records = [];
  for (let row = 59; row <= 95; row += 1) {
    const name = String(workbookCell(sheet, `${block.nameCol}${row}`) || "").trim();
    const amount = numericCell(sheet, `${block.amountCol}${row}`);
    if (!name || amount <= 0) continue;
    records.push(budgetImportExpenseRecord(year, row, name, amount));
  }
  return records;
}

async function parseBudgetWorkbook(buffer, year) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Budget") || workbook.worksheets[0];
  if (!sheet) {
    const err = new Error("No Budget sheet was found in the workbook.");
    err.status = 400;
    throw err;
  }

  const selectedYear = Number(year) || new Date().getFullYear();
  const records = [
    ...budgetImportIncomeRecords(sheet, selectedYear),
    ...budgetImportExpenseRecords(sheet, selectedYear)
  ].map(normalizeHoldingRecord);

  if (!records.length) {
    const err = new Error(`No importable Budget rows were found for ${selectedYear}.`);
    err.status = 400;
    throw err;
  }

  return { year: selectedYear, records };
}

async function importBudgetWorkbook(user, buffer, year) {
  const parsed = await parseBudgetWorkbook(buffer, year);
  const holdings = (await readHoldings(user)).map(normalizeHoldingRecord);
  let created = 0;
  let updated = 0;

  for (const record of parsed.records) {
    const existing = holdings.findIndex((holding) => holding.id === record.id);
    if (existing >= 0) {
      holdings[existing] = { ...holdings[existing], ...record, createdAt: holdings[existing].createdAt };
      updated += 1;
    } else {
      holdings.push({ ...record, createdAt: new Date().toISOString() });
      created += 1;
    }
  }

  await writeHoldings(user, holdings.sort((a, b) => a.category.localeCompare(b.category) || (a.symbol || a.name).localeCompare(b.symbol || b.name)));
  return {
    year: parsed.year,
    created,
    updated,
    total: parsed.records.length,
    categories: parsed.records.reduce((counts, record) => {
      counts[record.category] = (counts[record.category] || 0) + 1;
      return counts;
    }, {})
  };
}

function stooqSymbol(symbol) {
  if (symbol.includes(".")) return symbol.toLowerCase();
  return `${symbol.toLowerCase()}.us`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else current += char;
  }
  values.push(current);
  return values;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "finance-dashboard/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status} for ${url}`);
  }
  return response.text();
}

async function fetchQuote(symbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol(symbol))}&f=sd2t2ohlcv&h&e=csv`;
  const csv = await fetchText(url);
  const [headerLine, valueLine] = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  const values = parseCsvLine(valueLine || "");
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));

  if (!row.Close || row.Close === "N/D") {
    throw new Error(`No quote was returned for ${symbol}.`);
  }

  return {
    symbol,
    source: "Stooq",
    date: row.Date,
    time: row.Time,
    open: Number(row.Open),
    high: Number(row.High),
    low: Number(row.Low),
    price: Number(row.Close),
    volume: Number(row.Volume)
  };
}

async function fetchHistory(symbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol(symbol))}&i=d`;
  const csv = await fetchText(url);
  const lines = csv.trim().split(/\r?\n/).slice(1);
  return lines
    .map((line) => {
      const [date, open, high, low, close, volume] = parseCsvLine(line);
      return {
        date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume)
      };
    })
    .filter((row) => Number.isFinite(row.close))
    .slice(-260);
}

function yahooChartParams(rangeKey) {
  const now = Math.floor(Date.now() / 1000);
  if (rangeKey === "ytd") {
    const start = new Date(new Date().getFullYear(), 0, 1);
    return `period1=${Math.floor(start.getTime() / 1000)}&period2=${now}&interval=1d`;
  }

  const map = {
    "24h": "range=1d&interval=5m",
    "5d": "range=5d&interval=15m",
    "1m": "range=1mo&interval=1d",
    "1y": "range=1y&interval=1d",
    "5y": "range=5y&interval=1wk",
    "all": "range=max&interval=1mo"
  };
  return map[rangeKey] || map["24h"];
}

async function fetchYahooChart(symbol, rangeKey = "24h") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${yahooChartParams(rangeKey)}`;
  const raw = await fetchText(url);
  const parsed = JSON.parse(raw);
  const result = parsed.chart?.result?.[0];
  if (!result) {
    throw new Error(parsed.chart?.error?.description || `No Yahoo chart data was returned for ${symbol}.`);
  }

  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const history = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: Number(quote.open?.[index]),
      high: Number(quote.high?.[index]),
      low: Number(quote.low?.[index]),
      close: Number(quote.close?.[index]),
      volume: Number(quote.volume?.[index])
    }))
    .filter((row) => Number.isFinite(row.close));

  const meta = result.meta || {};
  const last = history.at(-1);
  return {
    quote: {
      symbol,
      source: "Yahoo Finance",
      date: last?.date || new Date().toISOString().slice(0, 10),
      time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toLocaleTimeString("en-US") : "",
      open: Number(meta.regularMarketOpen ?? last?.open),
      high: Number(meta.regularMarketDayHigh ?? last?.high),
      low: Number(meta.regularMarketDayLow ?? last?.low),
      price: Number(meta.regularMarketPrice ?? last?.close),
      volume: Number(meta.regularMarketVolume ?? last?.volume)
    },
    history
  };
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchNews(symbol) {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  const xml = await fetchText(url);
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const articles = [];
  let match;

  while ((match = itemRegex.exec(xml)) && articles.length < 24) {
    const item = match[1];
    const field = (name) => {
      const found = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
      return decodeEntities(found?.[1] || "").trim();
    };
    articles.push({
      title: field("title"),
      link: field("link"),
      source: field("source") || "Yahoo Finance",
      publishedAt: field("pubDate")
    });
  }

  const today = new Date().toDateString();
  return articles.filter((article) => {
    if (!article.title || !article.link) return false;
    if (!article.publishedAt) return true;
    return new Date(article.publishedAt).toDateString() === today;
  });
}

function searchCategoryMatch(result, category) {
  const symbol = result.symbol.toUpperCase();
  const name = result.name.toUpperCase();
  const quoteType = result.quoteType.toUpperCase();
  const type = result.type.toUpperCase();
  const exchange = result.exchange.toUpperCase();
  if (category === "crypto") return symbol.endsWith("-USD") || quoteType === "CRYPTOCURRENCY" || type.includes("CRYPTO");
  if (category === "stocks") return !symbol.includes("-USD") && !symbol.includes("=F") && !["CRYPTOCURRENCY", "FUTURE"].includes(quoteType) && !type.includes("CRYPTO");
  if (category === "commodities") {
    const commodityTerms = ["GOLD", "SILVER", "COPPER", "PLATINUM", "PALLADIUM", "OIL", "NATURAL GAS", "GASOLINE", "WHEAT", "CORN", "SOYBEAN", "COCOA", "COFFEE", "SUGAR", "COTTON", "COMMODITY", "COMMODITIES", "METALS", "ENERGY"];
    if (symbol.endsWith("-USD") || quoteType === "CRYPTOCURRENCY" || type.includes("CRYPTO")) return false;
    if (symbol.includes("=F") || quoteType === "FUTURE" || type.includes("FUTURE") || exchange === "CMX" || exchange === "NYM") return true;
    if (["ETF", "MUTUALFUND"].includes(quoteType) || type.includes("ETF") || type.includes("FUND")) return commodityTerms.some((term) => name.includes(term));
    return false;
  }
  return true;
}

async function searchSymbols(query, category = "") {
  const q = String(query || "").trim();
  if (q.length < 1) return [];
  const cleanCategory = String(category || "").trim().toLowerCase();

  const cacheKey = `${cleanCategory}:${q.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.payload;

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0`;
  const raw = await fetchText(url);
  const parsed = JSON.parse(raw);
  const payload = (parsed.quotes || [])
    .filter((quote) => quote.symbol && quote.shortname)
    .map((quote) => ({
      symbol: cleanSymbol(quote.symbol),
      name: quote.shortname || quote.longname || "",
      exchange: quote.exchange || quote.exchDisp || "",
      quoteType: quote.quoteType || "",
      type: quote.typeDisp || quote.quoteType || ""
    }))
    .filter((result) => searchCategoryMatch(result, cleanCategory))
    .slice(0, 8);

  searchCache.set(cacheKey, { createdAt: Date.now(), payload });
  return payload;
}

function pctChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function summarize(symbol, quote, history, news) {
  const latest = history.at(-1);
  const previous = history.at(-2);
  const weekBack = history.at(-6) || history[0];
  const dayChange = latest && previous ? pctChange(latest.close, previous.close) : null;
  const weekChange = latest && weekBack ? pctChange(latest.close, weekBack.close) : null;
  const direction = dayChange == null ? "has limited recent price data" : dayChange >= 0 ? "finished higher" : "finished lower";
  const newsPhrase = news.length
    ? `Recent coverage is led by "${news[0].title}".`
    : "No recent articles were returned by the configured news feed.";

  return {
    generatedAt: new Date().toISOString(),
    text: `${symbol} ${direction}${dayChange == null ? "" : ` by ${Math.abs(dayChange).toFixed(2)}% on the latest daily close`}. Weekly move: ${weekChange == null ? "not available" : `${weekChange.toFixed(2)}%`}. ${newsPhrase}`,
    dayChange,
    weekChange,
    latestClose: latest?.close ?? quote.price
  };
}

async function marketOverview(symbol, options = {}) {
  const clean = cleanSymbol(symbol);
  const range = String(options.range || "24h").toLowerCase();
  if (!clean) {
    const err = new Error("A stock symbol is required.");
    err.status = 400;
    throw err;
  }

  const cacheKey = `${clean}:${range}`;
  const cached = marketCache.get(cacheKey);
  if (!options.forceRefresh && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.payload;

  const [yahooResult, stooqQuoteResult, stooqHistoryResult, newsResult] = await Promise.allSettled([
    fetchYahooChart(clean, range),
    fetchQuote(clean),
    fetchHistory(clean),
    fetchNews(clean)
  ]);

  const yahooData = yahooResult.status === "fulfilled" ? yahooResult.value : null;
  const quote = yahooData?.quote || (stooqQuoteResult.status === "fulfilled" ? stooqQuoteResult.value : null);
  const history = yahooData?.history?.length ? yahooData.history : (stooqHistoryResult.status === "fulfilled" ? stooqHistoryResult.value : []);
  const news = newsResult.status === "fulfilled" ? newsResult.value : [];
  const errors = [yahooResult, stooqQuoteResult, stooqHistoryResult, newsResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason.message);

  const payload = {
    symbol: clean,
    range,
    quote,
    history,
    news,
    summary: quote || history.length ? summarize(clean, quote || {}, history, news) : null,
    errors
  };

  marketCache.set(cacheKey, { createdAt: Date.now(), payload });
  return payload;
}

async function handleAuthApi(req, res, url) {
  if (url.pathname === "/api/auth/status" && req.method === "GET") {
    const users = await readUsers();
    const user = await currentUser(req);
    return sendJson(res, 200, {
      authenticated: Boolean(user),
      hasUsers: users.length > 0,
      user: user ? publicUser(user) : null
    });
  }

  if (url.pathname === "/api/auth/reset-all-accounts" && req.method === "POST") {
    const body = await readBody(req);
    if (body.confirm !== "DELETE ACCOUNTS") {
      return sendJson(res, 400, { error: "Confirmation phrase did not match." });
    }
    await resetAllAccounts();
    res.setHeader("set-cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    return sendJson(res, 200, { authenticated: false, hasUsers: false });
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    const users = await readUsers();
    const body = await readBody(req);
    const username = cleanUsername(body.username);
    const password = String(body.password || "");
    if (username.length < 3) return sendJson(res, 400, { error: "Username must be at least 3 characters." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
    if (findUserByUsername(users, username)) return sendJson(res, 409, { error: "That account already exists. Try logging in or reset the password." });

    const user = {
      id: makeId(username) || crypto.randomBytes(8).toString("hex"),
      username,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    const isFirstUser = users.length === 0;
    users.push(user);
    await writeUsers(users);
    if (isFirstUser) await migrateLegacyHoldings(user);

    const token = makeSession(user);
    res.setHeader("set-cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
    return sendJson(res, 200, { authenticated: true, hasUsers: true, user: publicUser(user) });
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const username = cleanUsername(body.username);
    const users = await readUsers();
    const user = findUserByUsername(users, body.username);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return sendJson(res, 401, { error: "Incorrect username or password." });
    }
    if (username.includes("@") && user.username !== username) {
      user.username = username;
      await writeUsers(users);
    }

    const token = makeSession(user);
    res.setHeader("set-cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
    return sendJson(res, 200, { authenticated: true, hasUsers: true, user: publicUser(user) });
  }

  if (url.pathname === "/api/auth/reset-password" && req.method === "POST") {
    const body = await readBody(req);
    const username = cleanUsername(body.username);
    const password = String(body.password || "");
    if (username.length < 3) return sendJson(res, 400, { error: "Username must be at least 3 characters." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });

    const users = await readUsers();
    const user = findUserByUsername(users, body.username);
    if (!user) return sendJson(res, 404, { error: "No local account was found for that username." });

    user.username = username;
    user.passwordHash = hashPassword(password);
    user.updatedAt = new Date().toISOString();
    await writeUsers(users);

    const token = makeSession(user);
    res.setHeader("set-cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
    return sendJson(res, 200, { authenticated: true, hasUsers: true, user: publicUser(user) });
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    res.setHeader("set-cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    return sendJson(res, 200, { authenticated: false });
  }

  return sendJson(res, 404, { error: "Auth route not found." });
}

async function handleApi(req, res, url, user) {
  if (url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
  }

  if (url.pathname === "/api/holdings" && req.method === "GET") {
    return sendJson(res, 200, (await readHoldings(user)).map(normalizeHoldingRecord));
  }

  if (url.pathname === "/api/import/budget" && req.method === "POST") {
    const buffer = await readRawBody(req);
    const result = await importBudgetWorkbook(user, buffer, url.searchParams.get("year"));
    return sendJson(res, 200, { ...result, user: publicUser(user) });
  }

  if (url.pathname === "/api/holdings" && req.method === "POST") {
    const input = normalizeHolding(await readBody(req));
    const holdings = (await readHoldings(user)).map(normalizeHoldingRecord);
    const existing = holdings.findIndex((holding) => holding.id === input.id || (input.symbol && holding.category === input.category && holding.symbol === input.symbol));
    if (existing >= 0) holdings[existing] = { ...holdings[existing], ...input };
    else holdings.push({ ...input, createdAt: new Date().toISOString() });
    await writeHoldings(user, holdings.sort((a, b) => a.category.localeCompare(b.category) || (a.symbol || a.name).localeCompare(b.symbol || b.name)));
    return sendJson(res, 200, holdings);
  }

  const holdingMatch = url.pathname.match(/^\/api\/holdings\/([^/]+)$/);
  if (holdingMatch && req.method === "PUT") {
    const target = decodeURIComponent(holdingMatch[1]);
    const input = normalizeHolding({ ...(await readBody(req)), id: target });
    const holdings = (await readHoldings(user)).map(normalizeHoldingRecord);
    const index = holdings.findIndex((holding) => holding.id === target || holding.symbol === cleanSymbol(target));
    if (index < 0) return sendJson(res, 404, { error: `No holding found for ${target}.` });
    holdings[index] = { ...holdings[index], ...input };
    await writeHoldings(user, holdings);
    return sendJson(res, 200, holdings);
  }

  if (holdingMatch && req.method === "DELETE") {
    const target = decodeURIComponent(holdingMatch[1]);
    const cleanTarget = cleanSymbol(target);
    const holdings = (await readHoldings(user)).map(normalizeHoldingRecord).filter((holding) => holding.id !== target && holding.symbol !== cleanTarget);
    await writeHoldings(user, holdings);
    return sendJson(res, 200, holdings);
  }

  if (url.pathname === "/api/search" && req.method === "GET") {
    return sendJson(res, 200, await searchSymbols(url.searchParams.get("q"), url.searchParams.get("category")));
  }

  const marketMatch = url.pathname.match(/^\/api\/market\/([^/]+)$/);
  if (marketMatch && req.method === "GET") {
    return sendJson(res, 200, await marketOverview(decodeURIComponent(marketMatch[1]), {
      range: url.searchParams.get("range") || "24h",
      forceRefresh: url.searchParams.has("t") || url.searchParams.get("refresh") === "1"
    }));
  }

  return sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": [".html", ".css", ".js"].includes(ext) ? "no-store" : "public, max-age=300"
    });
    res.end(content);
  } catch {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(fallback);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/health") return sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
    if (url.pathname.startsWith("/api/auth/")) return await handleAuthApi(req, res, url);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url, await requireUser(req));
    return await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Unexpected server error." });
  }
});

ensureStorage()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Finance dashboard listening on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage:", error);
    process.exit(1);
  });

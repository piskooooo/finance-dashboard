const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const HOLDINGS_FILE = path.join(DATA_DIR, "holdings.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 15 * 60 * 1000);

const marketCache = new Map();

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
}

async function readHoldings() {
  await ensureStorage();
  const raw = await fs.readFile(HOLDINGS_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeHoldings(holdings) {
  await ensureStorage();
  await fs.writeFile(HOLDINGS_FILE, `${JSON.stringify(holdings, null, 2)}\n`);
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

function cleanSymbol(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function normalizeHolding(input) {
  const symbol = cleanSymbol(input.symbol);
  if (!symbol) {
    const err = new Error("A stock symbol is required.");
    err.status = 400;
    throw err;
  }

  return {
    symbol,
    name: String(input.name || "").trim(),
    shares: Number(input.shares || 0),
    avgCost: Number(input.avgCost || 0),
    notes: String(input.notes || "").trim(),
    updatedAt: new Date().toISOString()
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

async function fetchYahooChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
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

  while ((match = itemRegex.exec(xml)) && articles.length < 12) {
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

  return articles.filter((article) => article.title && article.link);
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
  if (!clean) {
    const err = new Error("A stock symbol is required.");
    err.status = 400;
    throw err;
  }

  const cached = marketCache.get(clean);
  if (!options.forceRefresh && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.payload;

  const [yahooResult, stooqQuoteResult, stooqHistoryResult, newsResult] = await Promise.allSettled([
    fetchYahooChart(clean),
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
    quote,
    history: history.slice(-30),
    news,
    summary: quote || history.length ? summarize(clean, quote || {}, history, news) : null,
    errors
  };

  marketCache.set(clean, { createdAt: Date.now(), payload });
  return payload;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
  }

  if (url.pathname === "/api/holdings" && req.method === "GET") {
    return sendJson(res, 200, await readHoldings());
  }

  if (url.pathname === "/api/holdings" && req.method === "POST") {
    const input = normalizeHolding(await readBody(req));
    const holdings = await readHoldings();
    const existing = holdings.findIndex((holding) => holding.symbol === input.symbol);
    if (existing >= 0) holdings[existing] = { ...holdings[existing], ...input };
    else holdings.push({ ...input, createdAt: new Date().toISOString() });
    await writeHoldings(holdings.sort((a, b) => a.symbol.localeCompare(b.symbol)));
    return sendJson(res, 200, holdings);
  }

  const holdingMatch = url.pathname.match(/^\/api\/holdings\/([^/]+)$/);
  if (holdingMatch && req.method === "PUT") {
    const target = cleanSymbol(decodeURIComponent(holdingMatch[1]));
    const input = normalizeHolding({ ...(await readBody(req)), symbol: target });
    const holdings = await readHoldings();
    const index = holdings.findIndex((holding) => holding.symbol === target);
    if (index < 0) return sendJson(res, 404, { error: `No holding found for ${target}.` });
    holdings[index] = { ...holdings[index], ...input };
    await writeHoldings(holdings);
    return sendJson(res, 200, holdings);
  }

  if (holdingMatch && req.method === "DELETE") {
    const target = cleanSymbol(decodeURIComponent(holdingMatch[1]));
    const holdings = (await readHoldings()).filter((holding) => holding.symbol !== target);
    await writeHoldings(holdings);
    return sendJson(res, 200, holdings);
  }

  const marketMatch = url.pathname.match(/^\/api\/market\/([^/]+)$/);
  if (marketMatch && req.method === "GET") {
    return sendJson(res, 200, await marketOverview(decodeURIComponent(marketMatch[1]), {
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
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=300"
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
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
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

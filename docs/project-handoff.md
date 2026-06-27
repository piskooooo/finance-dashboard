# Finance Dashboard Project Handoff

## Product Goal And Current Status

The goal is a private, self-hosted finance dashboard that the user can run from a NAS, especially Unraid, as a Docker container. The user manually enters holdings and accounts for now. Anything with a public ticker should be enriched automatically from public market data; everything else should stay manual.

The app currently supports:

- Local register/login/reset flows with server-side JSON persistence.
- Dashboard-first layout with sidebar tabs.
- Stocks, crypto, commodities, alt investments, properties, credit cards, loans, cash, income, and expenses.
- Yahoo Finance autocomplete and market data for ticker-tracked categories.
- News and performance summaries for market-tracked holdings.
- Manual edit/delete flows for entries.
- Cash-flow estimates, debt/payment summaries, net worth, allocation charts, and calendar events.
- Docker Compose from source and GHCR image deployment.
- Unraid-friendly volume mapping and `PUID`/`PGID`.

Important privacy status: user-specific data should live only in mounted runtime data. Do not put personal emails, account records, uploaded spreadsheet contents, or generated user data into public GitHub docs or source.

## Repo Structure

```text
.
├── AGENTS.md                    # Durable instructions for future Codex threads
├── Dockerfile                   # Production image
├── README.md                    # Public setup docs
├── docker-compose.yml           # Local/source build compose
├── docker-compose.ghcr.yml      # NAS/GHCR compose
├── docker-entrypoint.sh         # PUID/PGID runtime user handling
├── package.json                 # Node scripts/deps
├── server.js                    # Plain Node HTTP server and APIs
├── public/
│   ├── index.html               # Static app shell
│   ├── app.js                   # Vanilla frontend state/rendering/API calls
│   └── styles.css               # Dashboard styling/themes/responsive layout
├── data/
│   └── .gitkeep                 # Runtime mount placeholder only
└── .github/workflows/
    └── docker-publish.yml       # GHCR multi-arch image publishing
```

Runtime files are intentionally not part of source:

```text
data/users.json
data/users/<user-id>/holdings.json
```

## Setup, Run, And Test Commands

Install dependencies:

```bash
npm install
```

Run locally on the default internal app port:

```bash
npm run dev
```

Run locally on another port:

```bash
PORT=9999 npm run dev
```

Run source-built Docker:

```bash
cp .env.example .env
docker compose up --build -d
```

Run GHCR image on Unraid/NAS:

```bash
cp .env.example .env
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

Useful Unraid mapping:

```env
APP_PORT=9999
DATA_PATH=/mnt/user/appdata/finance-dashboard/data
PUID=99
PGID=100
```

When the user maps host `9999` to container `3000`, the WebUI is:

```text
http://[IP]:[PORT:9999]/
```

If they deliberately map host `9999` to container `80`, the container must run with `PORT=80`, and the WebUI is still:

```text
http://[IP]:[PORT:9999]/
```

Validation commands:

```bash
node --check server.js
node --check public/app.js
git diff --check
```

There is no formal automated test suite yet. For UI work, run the app and browser-test the specific flow. Check page identity, nonblank render, framework/browser console errors, one real interaction, and responsive behavior when layout is changed.

## Key Architecture Decisions

- Plain Node server, no Express. This keeps the container small and easy to reason about.
- Static vanilla frontend, no build step. This makes Unraid deployment simple and avoids frontend bundler complexity.
- Server-side JSON persistence, one file per user. This is sufficient for a single-user NAS app and avoids introducing a database before needed.
- Local auth only. There is no email service, OAuth provider, or cloud account.
- Passwords are stored with `crypto.scryptSync`; sessions are stored in memory and represented by a cookie.
- Brokerage/bank linking is intentionally avoided. The user prefers manual entry first.
- Market-tracked categories are `stocks`, `crypto`, and `commodities`.
- Non-market categories are manual unless a future API integration is explicitly added.
- Quotes/history use Yahoo Finance chart endpoints with Stooq fallback. These are unofficial and should be treated as fragile.
- News uses Yahoo Finance RSS.
- Calendar events include hardcoded market/Fed dates and generated entry dates such as debt due dates.
- Theme accent is data-driven: green for up, red for down more than about 1%, blue/neutral in between, over a black/gray/white base.
- Docker image supports Unraid `PUID`/`PGID`; GHCR workflow publishes `linux/amd64` and `linux/arm64`.

## Current Open Tasks

No active blocking task is in progress at the time of this handoff.

Useful next tasks:

- Update `README.md` so it reflects the full app, not just the earlier stock-focused version.
- Add automated tests for server normalization, auth, payoff math, and monthly cash-flow calculations.
- Add a small Playwright smoke test for login, tab switching, add/edit/delete, and dashboard render.
- Consider replacing JSON writes with SQLite if records grow or multi-user/concurrent writes become important.
- Add scheduled daily/weekly snapshots if the user wants true historical performance tracking.
- Add optional notification outputs such as Discord, email, or ntfy for summaries/alerts.
- Explore optional Ollama-assisted summaries/sentiment only as on-demand jobs, not background processes.
- Explore alt-investment data APIs only if terms/access are reasonable: PriceCharting, WorthPoint, TCGplayer, eBay, StockX, etc.
- Review and either remove or formalize the hidden budget import code path.

## Known Bugs Or Fragile Areas

- `README.md` is stale in places and under-describes the current dashboard breadth.
- Market and news providers are unofficial and can rate-limit, change response shape, or fail.
- Sessions are in memory. Container restart logs the user out.
- JSON persistence has no file locking. It is okay for single-user use but fragile for concurrent writes.
- Password reset and reset-all-accounts are intentionally simple/local and not production-grade.
- There is no CSRF protection. This is acceptable only for a trusted private LAN deployment.
- Calendar market holidays/Fed dates are hardcoded and will need updating over time.
- Credit card payoff estimates depend heavily on minimum-payment assumptions.
- Budget import code remains in `server.js` and `public/app.js` even though the visible import button was removed.
- Static asset cache busting is manual via query strings in `public/index.html`.
- `data/` must stay mounted on Unraid or app updates will appear to wipe saved data.

## Conventions Expected By The User

- Keep public GitHub safe. Never include the user email, account details, spreadsheet contents, private holdings, or NAS secrets.
- Preserve Docker/NAS friendliness. Compose and Unraid instructions matter as much as local dev.
- The main page should be the dashboard, with sidebar navigation like the user’s CRM.
- Prefer practical, dense dashboard UI over marketing-page styling.
- Keep cash, credit, loans, income, expenses, and properties mostly manual.
- Track location/account tags for stocks, crypto, commodities, and alt investments; cash/credit/loans normally imply bank/lender.
- Support fractional quantities and total-dollar entry for assets.
- Cost basis should be clear about per-unit versus total cost.
- For articles, show a compact set first and allow expansion when more are available.
- Auto-refresh market data periodically and when switching relevant tabs, but keep manual refresh.
- AI/Ollama features should be optional and on-demand; smaller models are preferred.
- Do not run background AI jobs 24/7.

## Context From The Thread Not Obvious From Code

- The user originally built this alongside a Discord stock bot and a real estate CRM; they expect a similar Docker/GitHub/Unraid workflow.
- The user has previously used port `9999` because port `3000` was occupied.
- A prior Unraid issue came from the app listening on internal `3000` while the template expected `80`; if using `9999:80`, set container `PORT=80`.
- The user has NAS-hosted services available for future use, including Redis, Qdrant, Adminer, Ollama, and GPU acceleration.
- The budget spreadsheet import was experimental and should not leak personal budget data into the repo.
- The app was deliberately changed to local accounts because the user wanted data to survive updates without re-entry.
- The account reset flow was intentionally permissive because this is currently a private single-user app.
- The sidebar icons are inline SVGs, not external images, so they should not create missing asset requests.
- The brand/footer text requested by the user is `Fat Cat Finance LLC`.

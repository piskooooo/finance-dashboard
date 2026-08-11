# Finance Dashboard Project Handoff

## Product Goal And Current Status

The goal is a private, self-hosted finance dashboard that the user can run from a NAS, especially Unraid, as a Docker container. The user manually enters holdings and accounts for now. Anything with a public ticker should be enriched automatically from public market data; everything else should stay manual.

The app currently supports:

- Local register/login flows, authenticated account reset, and optional local-only password recovery with server-side JSON persistence.
- Dashboard-first layout with sidebar tabs.
- Stocks, crypto, commodities, alt investments, properties, credit cards, loans, cash, income, and expenses.
- Yahoo Finance autocomplete and market data for ticker-tracked categories.
- News and performance summaries for market-tracked holdings.
- Manual edit/delete flows for entries.
- Cash-flow estimates, debt/payment summaries, net worth, allocation charts, and calendar events.
- Docker Compose from source and GHCR image deployment.
- Unraid-friendly volume mapping and `PUID`/`PGID`.
- Node 22/24 integration checks in GitHub Actions; production Docker image based on Node 24 LTS.

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
├── test/
│   └── server.test.js            # Node integration coverage for core HTTP behavior
├── public/
│   ├── index.html               # Static app shell
│   ├── app.js                   # Vanilla frontend state/rendering/API calls
│   └── styles.css               # Dashboard styling/themes/responsive layout
├── data/
│   └── .gitkeep                 # Runtime mount placeholder only
└── .github/workflows/
    └── docker-publish.yml       # Node checks and GHCR multi-arch publishing
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

Use Node.js 22 or newer locally. The production container runs Node.js 24 LTS.

Run locally on the default internal app port:

```bash
npm run dev
```

Run locally on another port:

```bash
PORT=9999 npm run dev
```

Run the focused integration checks:

```bash
npm test
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
npm audit --audit-level=moderate
git diff --check
```

The project has a focused Node integration test for auth, holdings CRUD, security headers, request limits, and missing-route behavior:

```bash
npm test
```

For UI work, also run the app and browser-test the specific flow. Check page identity, nonblank render, browser console errors, one real interaction, and responsive behavior when layout is changed.

## Key Architecture Decisions

- Plain Node server, no Express. This keeps the container small and easy to reason about.
- Node 22+ is supported locally; the production image uses Node 24 LTS because Node 20 is end-of-life.
- Static vanilla frontend, no build step. This makes Unraid deployment simple and avoids frontend bundler complexity.
- Server-side JSON persistence, one file per user, with atomic file replacement. This is sufficient for light single-instance NAS use and avoids introducing a database before needed.
- Local auth only. There is no email service, OAuth provider, or cloud account.
- Passwords are stored with `crypto.scryptSync`; sessions are stored in memory and represented by a cookie.
- Brokerage/bank linking is intentionally avoided. The user prefers manual entry first.
- Market-tracked categories are `stocks`, `crypto`, and `commodities`.
- Non-market categories are manual unless a future API integration is explicitly added.
- Quotes/history use Yahoo Finance chart endpoints with Stooq fallback. These are unofficial and should be treated as fragile.
- News uses Yahoo Finance RSS.
- Calendar events include maintained 2026-2027 market/Fed dates and generated entry dates such as debt due dates.
- Theme accent is data-driven: green for up, red for down more than about 1%, blue/neutral in between, over a black/gray/white base.
- Docker image supports Unraid `PUID`/`PGID`; the GHCR workflow runs Node 22/24 checks and publishes `linux/amd64` and `linux/arm64`.

## Current Open Tasks

No active blocking task is in progress at the time of this handoff.

Useful next tasks:

- Expand automated tests for normalization, payoff math, monthly cash-flow calculations, and malformed runtime data.
- Add a small Playwright smoke test for login, tab switching, add/edit/delete, and dashboard render.
- Consider replacing JSON writes with SQLite if records grow or multi-user/concurrent writes become important.
- Add scheduled daily/weekly snapshots if the user wants true historical performance tracking.
- Add optional notification outputs such as Discord, email, or ntfy for summaries/alerts.
- Explore optional Ollama-assisted summaries/sentiment only as on-demand jobs, not background processes.
- Explore alt-investment data APIs only if terms/access are reasonable: PriceCharting, WorthPoint, TCGplayer, eBay, StockX, etc.
- Review and either remove or formalize the hidden budget import code path.

## Known Bugs Or Fragile Areas

- Market and news providers are unofficial and can rate-limit, change response shape, or fail.
- Sessions are in memory. Container restart logs the user out.
- JSON replacement is atomic, but read-modify-write operations have no cross-process locking. It remains intended for light, single-instance use.
- Password recovery remains deliberately disabled unless local-only recovery is enabled; there is no email or external identity recovery.
- Browser mutations use same-origin checks, but the app still belongs on a trusted LAN or behind HTTPS and an external access layer.
- Calendar market holidays and FOMC dates are maintained as static 2026-2027 data and will need a future refresh.
- Credit card payoff estimates depend heavily on minimum-payment assumptions.
- Budget import code remains in `server.js` and `public/app.js` even though the visible import button was removed; it is not a supported public workflow.
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
- Account reset now requires authentication after an account exists; unauthenticated password recovery is separately disabled by default.
- The sidebar icons are inline SVGs, not external images, so they should not create missing asset requests.
- The brand/footer text requested by the user is `Fat Cat Finance LLC`.

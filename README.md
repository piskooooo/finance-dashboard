# Finance Dashboard

A small self-hosted dashboard for manually entered finances. It stores account data locally in the mounted `data` folder, fetches quote/history data from Yahoo Finance with a Stooq fallback, and fetches stock-specific news from Yahoo Finance RSS.

## What works now

- Create a local login on first run and keep each user's finance data in private server-side JSON files.
- Track stocks, crypto, commodities, alt investments, properties, credit cards, loans, cash, income, and expenses.
- Use Yahoo Finance autocomplete and market data for ticker-tracked assets.
- View quotes, performance summaries, compact news, net worth, allocation, debt/payment, cash-flow, and calendar panels.
- Add, update, and remove manual entries without linking brokerage or bank accounts.
- Run locally with Node or on a NAS using Docker Compose or the GHCR image.

## Local development

```bash
npm run dev
```

Open `http://localhost:3000`.

On first launch, create the local dashboard account from the login screen. If an older `data/holdings.json` exists, its records are copied into the first account automatically.

## Docker Compose from source

```bash
cp .env.example .env
docker compose up --build -d
```

The app will be available at `http://localhost:3000`.

## Docker Compose from GitHub Container Registry

The included GitHub Actions workflow publishes an image to:

```text
ghcr.io/piskooooo/finance-dashboard:latest
```

On your NAS, copy `.env.example` to `.env`, set `IMAGE_NAME`, and run:

```bash
cp .env.example .env
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

Example `.env` for Unraid:

```env
APP_PORT=3000
DATA_PATH=/mnt/user/appdata/finance-dashboard/data
IMAGE_NAME=ghcr.io/piskooooo/finance-dashboard:latest
CACHE_TTL_MS=900000
PUID=99
PGID=100
```

## Unraid notes

For Unraid, the cleanest setup is:

1. Create an appdata folder:

```text
/mnt/user/appdata/finance-dashboard
```

2. Put your `.env` file and either Compose file there.
3. Use the GHCR Compose file if you want the NAS to pull your published image instead of building locally.
4. Keep `DATA_PATH=/mnt/user/appdata/finance-dashboard/data` so your typed holdings survive container updates.
5. Use `PUID=99` and `PGID=100` on Unraid unless you intentionally run appdata as a different user/group.

The container exposes port `3000` internally by default. If your Unraid template is easier to set up as `9999:80`, set `PORT=80`; the image supports binding to port 80 while still running the app as `PUID:PGID`.

## Login and data persistence

The app uses a local first-run account setup. There is no external auth provider and no cloud account.

Runtime files live under the Docker-mounted `DATA_PATH`:

```text
users.json
users/<username>/holdings.json
```

Older single-user installs used `holdings.json` at the root of the data folder. When you create the first login, the app copies those older holdings into the new account folder if it finds them. Keep the `DATA_PATH` mapped to appdata on Unraid before updating the container, because GitHub and the Docker image do not contain your private data.

## GitHub setup

This checkout already tracks:

```text
https://github.com/piskooooo/finance-dashboard.git
```

After pushing to `main`, check the repository's Actions tab. The `Publish Docker image` workflow should build and publish `linux/amd64` and `linux/arm64` images to GitHub Container Registry.

If the package is private, your NAS will need to authenticate to GHCR before pulling:

```bash
docker login ghcr.io
```

If you make the package public, the NAS can pull without logging in.

## Data sources

This first version intentionally avoids brokerage linking and API keys.

- Quotes/history: Yahoo Finance chart endpoint, with Stooq CSV as a fallback
- News: Yahoo Finance RSS headlines

Those providers can rate limit or change behavior. The server keeps provider access in `server.js`, so moving to Finnhub, Polygon, Alpha Vantage, or a paid news provider later should be a contained change.

## Next upgrades

- Add scheduled daily or weekly snapshots in a local database.
- Add portfolio-level allocation and gain/loss views.
- Add email, Discord, or ntfy weekly summaries.
- Add API-key based market/news providers for more reliable coverage.

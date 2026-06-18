# Finance Dashboard

A small self-hosted dashboard for manually entered stock holdings. It stores your holdings locally in `data/holdings.json`, fetches quote/history data from Yahoo Finance with a Stooq fallback, and fetches stock-specific news from Yahoo Finance RSS.

## What works now

- Add, update, select, and remove stock holdings manually.
- View a selected stock's last quote, daily move, weekly move, 30-day price line, and estimated position value.
- See recent news articles for the selected ticker.
- Read an auto-generated daily/weekly summary based on recent performance and the top returned article.
- Run locally with Node or on a NAS using Docker Compose.

## Local development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Docker Compose from source

```bash
cp .env.example .env
docker compose up --build -d
```

The app will be available at `http://localhost:3000`.

## Docker Compose from GitHub Container Registry

After this repo is pushed to GitHub, the included GitHub Actions workflow publishes an image to:

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

## GitHub setup

From this folder:

```bash
git init
git add .
git commit -m "Initial finance dashboard"
git branch -M main
git remote add origin git@github.com:piskooooo/finance-dashboard.git
git push -u origin main
```

Then in GitHub, check the repository's Actions tab. The `Publish Docker image` workflow should build and publish `linux/amd64` and `linux/arm64` images to GitHub Container Registry.

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

- Add authentication before exposing beyond your LAN.
- Add scheduled daily or weekly snapshots in a local database.
- Add portfolio-level allocation and gain/loss views.
- Add email, Discord, or ntfy weekly summaries.
- Add API-key based market/news providers for more reliable coverage.

# Agent Guidance

This repo is the self-hosted Finance Dashboard, not the real estate CRM, though the user often wants CRM-style ergonomics: dashboard first, sidebar navigation, dense useful panels, and Docker/NAS deployment.

## Canonical Project Root

- Work from `/Users/pisko/Documents/finance-dashboard`.

## Product Goal

Build a private, self-hosted personal finance dashboard for manually entered assets, debts, income, and expenses. It should run cleanly on Unraid via Docker, persist user data in mounted appdata, and avoid linking to brokerage or bank accounts unless the user explicitly asks later.

Current status: usable single-app dashboard with local login, JSON-backed per-user data, market lookup for stocks/crypto/commodities, manual sections for cash/credit/loans/properties/income/expenses/alt investments, security hardening, a focused Node integration test, Docker Compose files, and GHCR publishing. Production containers run Node 24 LTS; local development supports Node 22+.

## Runbook

- Install: `npm install`
- Local dev: `npm run dev`
- Alternate local port: `PORT=9999 npm run dev`
- Integration checks: `npm test`
- Dependency check: `npm audit --audit-level=moderate`
- Syntax check: `node --check server.js && node --check public/app.js`
- Whitespace check: `git diff --check`
- Compose validation: `docker compose config && docker compose -f docker-compose.ghcr.yml config`
- Source Docker: `docker compose up --build -d`
- GHCR Docker: `docker compose -f docker-compose.ghcr.yml pull && docker compose -f docker-compose.ghcr.yml up -d`

The focused Node integration test covers local auth, holdings CRUD, security headers, request limits, and missing routes. Full browser automation is still planned. For frontend changes, run the app and do browser QA on the changed flow, including console errors and at least one responsive/mobile check when layout is touched.

## Architecture

- `server.js` is a plain Node HTTP server. Keep changes framework-free unless the user explicitly approves a migration.
- `public/index.html`, `public/app.js`, and `public/styles.css` are the vanilla frontend.
- Runtime data lives under `DATA_DIR`, usually Docker-mounted to `/app/data`.
- User records live in `users.json`; finance records live under `users/<user-id>/holdings.json`. JSON replacements are atomic, but read-modify-write operations are not cross-process locked.
- Sessions are in-memory cookies. They are `HttpOnly` and `SameSite=Lax`, and become `Secure` for HTTPS-aware requests. Restarting the container logs users out but should not lose saved data.
- API mutations apply same-origin checks, JSON bodies are size-limited, and upstream market/news requests have a timeout.
- Market data uses unofficial Yahoo Finance endpoints with Stooq fallback. News uses Yahoo Finance RSS.
- Docker supports Unraid-friendly `PUID`/`PGID` and appdata volume mapping.

## Conventions

- Do not commit private runtime data, personal emails, spreadsheet contents, API keys, or NAS-specific secrets.
- Keep public docs generic and safe for GitHub.
- Preserve the dashboard-first/sidebar UX.
- Prefer small, scoped edits in the existing vanilla JS/CSS style.
- When changing static JS/CSS, bump cache query strings in `public/index.html`.
- Use `apply_patch` for manual edits.
- Validate Docker/Unraid-facing changes with config/build checks when Docker is available; if it is not, say so clearly.
- If a request mentions the CRM, verify whether the current repo is actually the finance dashboard before editing.

## More Context

Longer handoff notes, backlog, and fragile areas live in `docs/project-handoff.md`.

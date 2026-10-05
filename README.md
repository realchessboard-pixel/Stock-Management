# StockFlow

Mobile-first inventory management for small shops: **scan → receive / remove → confirm → stock updated**.

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for architecture and the phase plan.

## Run it on your own computer (no hosting)

See **[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)** — needs only Node.js; the database is bundled
(`embedded-postgres`), phones connect from anywhere over HTTPS via Tailscale Funnel, nightly
backups and auto-restart are built in.

## Local development

Requirements: Node 22 (see `.nvmrc`), PostgreSQL 14+.

```bash
cp .env.example .env          # fill in DATABASE_URL, TEST_DATABASE_URL, SESSION_SECRET
npm install                   # also runs `prisma generate`
npm run db:migrate            # apply migrations
npm run dev                   # http://localhost:3000 → "Create a free account"
```

## Checks

```bash
npm run typecheck   # route types + tsc
npm run lint
npm test            # unit + integration tests (uses TEST_DATABASE_URL, which is wiped)
npm run build && npm run test:e2e   # browser tests on an emulated Android phone (Playwright)
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push. Dependabot opens one grouped
dependency-update PR per month; merge it when CI is green.

## Android / install as an app

StockFlow is a Progressive Web App. On Android Chrome open the site, then tap **Install app**
(dashboard banner or **More → Install StockFlow app**). It opens full screen, has an icon and
long-press shortcuts for Scan, Receive and Stock out. Camera scanning needs HTTPS (any normal
hosting provides it; `localhost` also works for development).

- Barcode scanning uses Chrome's built-in barcode detector on Android, with an automatic
  fallback for other browsers. Bluetooth/USB scanner guns also work.
- The service worker caches only app files and an offline page — never shop data.

## Operations (low maintenance)

- `GET /api/health` → `200 {"status":"ok"}` when the app and database are up. Point an uptime monitor at it.
- Expired sessions, old rate-limit counters and idempotency keys are cleaned up automatically
  (every 6 hours, no cron job needed).
- Unhandled server errors are logged once as JSON lines (`"event":"request.unhandled"`) to stdout.
- Performance check on a large demo shop: `npm run perf:seed` (creates 5,000 products and
  ~50,000 movements) then `npm run perf:check <businessId>`.

## Layout

- `src/app` — routes (thin). `(auth)` = login/signup, `(app)` = signed-in shell, `(print)` = labels.
- `src/server` — all business logic (server-only): auth, tenancy, permissions, inventory engine,
  imports, reports, audit, billing, storage, maintenance.
- `src/lib` — client-safe shared code: Zod schemas, permission map, errors, formatting.
- `prisma/` — schema and migrations (includes hand-written integrity SQL: composite tenant FKs,
  append-only triggers, check constraints, trigram indexes).
- `tests/` — `unit`, `integration` (real Postgres), `e2e` (Playwright, Android emulation).

# StockFlow

Mobile-first inventory management for small shops: **scan → receive / remove → confirm → stock updated**.

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for architecture and the phase plan.

## Local development

Requirements: Node 20.9+, PostgreSQL 14+.

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
```

## Layout

- `src/app` — routes (thin). `(auth)` = login/signup, `(app)` = signed-in shell.
- `src/server` — all business logic (server-only): auth, tenancy, permissions, audit, billing.
- `src/lib` — client-safe shared code: Zod schemas, permission map, errors.
- `prisma/` — schema and migrations (includes hand-written integrity SQL: composite tenant FKs, append-only triggers, check constraints).

# StockFlow — Implementation Plan

> Mobile-first mini ERP / inventory SaaS for small Indian retailers.
> Core loop: **SCAN → RECEIVE / REMOVE → CONFIRM → STOCK UPDATED**

## 0. Repository inspection (2026-10-04)

- `Stock-Management` contains only a one-line `README.md` and an initial commit. No existing code, schema, or config to preserve.
- Toolchain available: Node 22, npm 10, PostgreSQL 16 (local, used for dev + integration tests), Docker, Chromium/Playwright.
- Conclusion: greenfield. Initialise the architecture below from scratch.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, React 19, `src/` layout) | Server Components + Server Actions keep business logic on the server |
| Language | TypeScript, `strict` | |
| Styling | Tailwind CSS v4 + small in-house component set | No heavy UI kit; big touch targets |
| DB / ORM | PostgreSQL + Prisma (latest stable 7.x) | Transactions, row locks, migrations |
| Validation | Zod — one schema per command, shared by form + server | Server always re-validates |
| Auth | Own session auth: password (argon2id) + DB-backed opaque sessions in `httpOnly`, `Secure`, `SameSite=Lax` cookies; token stored hashed | Small surface, no third-party dependency; phone-OTP can plug in later |
| Barcode render | `bwip-js` (Code 128 SVG/PNG) | Pure JS, works server + client |
| Barcode scan | Native `BarcodeDetector` when present → fallback `@zxing/browser`; plus manual entry and USB/Bluetooth HID ("keyboard wedge") scanners | Robust across Android Chrome, iOS Safari, desktop |
| Import | `papaparse` (CSV), `exceljs` (XLSX) | |
| Tests | Vitest (unit + integration on a real Postgres test DB), Playwright (mobile-viewport E2E smoke) | |
| PWA | Web manifest, icons, hand-written service worker (app-shell caching) | |

## 2. Architecture

```
src/
  app/                     # routes only — thin
    (auth)/login, signup
    (app)/                 # authenticated shell (bottom nav mobile / sidebar desktop)
      dashboard, products, scan, receive, stock-out, adjust,
      movements, low-stock, suppliers, categories, locations,
      reports, users, audit, settings, onboarding
    api/                   # route handlers only where needed (exports, barcode PNG, import upload)
  server/                  # ALL business logic; never imported by client components
    auth/                  # sessions, password hashing, rate limiting
    tenancy/               # getTenantContext(): {businessId, userId, role} from session ONLY
    permissions/           # role -> permission map, assertCan(ctx, 'stock.receive')
    inventory/             # STOCK MOVEMENT ENGINE (single entry point for stock changes)
    products/ categories/ brands/ suppliers/ locations/
    barcodes/              # generation, uniqueness, internal sequence
    imports/               # parse -> validate -> preview -> commit (all-or-nothing)
    reports/ dashboard/
    audit/                 # append-only audit writer
    billing/               # plans + entitlements (FREE/BASIC/PRO) — isolated from inventory
    notifications/         # LowStockNotifier interface (in-app now; WhatsApp/email later)
  lib/                     # shared, client-safe: zod schemas, formatting (₹, dates), errors
  components/              # UI kit + feature components
prisma/ schema.prisma, migrations/, seed.ts
tests/ unit/, integration/, e2e/
```

Rules:
- Every mutation = **Server Action → Zod parse → `getTenantContext()` → `assertCan()` → service in `src/server` → transaction**.
- `businessId` is **never** accepted from the client. Services take a `ctx` and every query filters by `ctx.businessId`.
- `import 'server-only'` in all `src/server/**` modules so secrets/DB can't leak to the client bundle.
- Errors: typed `AppError` (`NOT_FOUND`, `INSUFFICIENT_STOCK`, `DUPLICATE_SKU`, `DUPLICATE_BARCODE`, `FORBIDDEN`, `VALIDATION`, …) mapped to human messages; unknown errors logged server-side, user sees a generic message (no stack traces).

## 3. Data model (Prisma)

All business-owned tables carry `businessId` + index; uniqueness is per tenant.

- **Business** (name, ownerName, gstin, currency=INR, `allowNegativeStock`=false, `plan`=FREE, barcodeSeq)
- **User** (name, email/phone unique, passwordHash) · **Membership** (userId, businessId, role) — allows one user in multiple shops later
- **Role** enum OWNER | MANAGER | STAFF (permissions mapped in code, extensible to custom roles)
- **Session** (tokenHash, userId, activeBusinessId, expiresAt)
- **Category**, **Brand**, **Supplier** (name, company, phone, email, address, gstin, notes)
- **Product** (name, sku, description, unit, purchasePrice, sellingPrice, mrp, minStock, gstRate, hsnSac, imageUrl, isActive, archivedAt, categoryId, brandId, preferredSupplierId) — `@@unique([businessId, sku])`
- **Barcode** (productId, code, kind GENERATED|MANUFACTURER|MANUAL) — `@@unique([businessId, code])`; MVP enforces one per product, table allows more later
- **StockLocation** (name, type STORE|WAREHOUSE|RACK|BIN, parentId) — "Main Store" auto-created; hierarchy supports multi-warehouse later
- **InventoryBalance** (businessId, productId, locationId, quantity) — `@@unique([productId, locationId])`
- **StockMovement** (businessId, productId, locationId, type, direction IN|OUT, quantity, previousBalance, newBalance, unitCost, referenceType, referenceId, reason, userId, idempotencyKey, createdAt) — `@@unique([businessId, idempotencyKey])`, indexes on (businessId, productId, createdAt), (businessId, createdAt), (businessId, type)
- Movement types: OPENING, PURCHASE, SALE, CUSTOMER_RETURN, SUPPLIER_RETURN, DAMAGE, LOSS, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT
- **Purchase / PurchaseItem** — created by Receive Stock (supplier, price); movement references it
- **Sale / SaleItem** — created by Stock Out; minimal now, becomes POS/invoice in Phase 2 of the product
- **AuditLog** (businessId, userId, action, entityType, entityId, metadata JSON, ip, createdAt) — insert-only; no update/delete code path; DB trigger blocks UPDATE/DELETE
- Quantities `Decimal(14,3)` (pieces, metres, kg); money `Decimal(12,2)`.

## 4. Stock movement engine (critical)

Single function `postStockMovements(ctx, command)` — the only code allowed to change stock:

1. Begin transaction.
2. If `idempotencyKey` already used → return the original result (double-tap safe).
3. `SELECT … FOR UPDATE` the `InventoryBalance` row(s) (create at 0 if missing) — serialises concurrent changes to the same product/location.
4. Compute `newBalance` server-side from DB values; client quantities/prices are only *inputs*, re-validated (positive, sane precision).
5. If `newBalance < 0` and `!business.allowNegativeStock` → `INSUFFICIENT_STOCK`.
6. Insert `StockMovement` (prev/new balance), update `InventoryBalance`, write `AuditLog`, create Purchase/Sale doc where relevant.
7. Commit. Any failure rolls back everything → movement and balance can never diverge.

Invariant tested: `balance == Σ signed(movement.quantity)` per product/location, and each movement's `previousBalance` equals the prior movement's `newBalance`.

Idempotency: each form render generates a UUID key; buttons also disable on submit. The same design makes a future offline queue (IndexedDB → replay) safe.

## 5. Roles & permissions

| Permission | OWNER | MANAGER | STAFF |
|---|---|---|---|
| scan, view products, receive, stock out | ✓ | ✓ | ✓ |
| adjust stock, products CRUD, categories, suppliers, locations, import/export, reports, ledger | ✓ | ✓ | – |
| users & roles, business settings, audit log, negative-stock toggle | ✓ | – | – |

Permission strings (`stock.receive`, `product.write`, …) so new permissions/custom roles slot in later.

## 6. Security checklist

Authentication, tenant-scoped queries + isolation tests, Zod on every input, server-side price/qty validation, argon2id hashing, session rotation on login, rate limiting on login/signup (in-memory, pluggable to Redis), CSRF via `SameSite=Lax` + Next's Server Action origin check + Origin check on route handlers, security headers (CSP, frame-ancestors, etc.), no secrets in `NEXT_PUBLIC_*`, Prisma parameterised queries only, CSV-injection-safe exports, upload size limits.

## 7. UX outline

- **Mobile**: bottom nav `Dashboard · Inventory · [SCAN] · Movements · More`; Scan is a large raised centre button.
- **Desktop (≥1024px)**: sidebar with Dashboard, Products, Inventory, Stock Movements, Suppliers, Locations, Reports, Users, Settings.
- Scan result sheet: product, current stock, big buttons `+ Receive`, `– Stock Out`, `Adjust`, `View`, `Ledger`; unknown code → "Product not found" + `Create Product` (barcode pre-filled).
- Receive / Stock Out: one screen, numeric keypad input, steppers, Confirm → success state with "Print labels" / "Scan next".
- Onboarding wizard: business → owner → first product → opening stock → barcode → print label → done.
- Every list: loading skeletons, empty states with a clear next action, inline error states. Plain language (no ERP jargon), ₹ formatting, en-IN dates.

## 8. Phases (each ends with: tests, `tsc`, lint, fixes, UI check, security review, commit + push)

| Phase | Scope | Commit(s) |
|---|---|---|
| 1 | Next.js/TS/Tailwind/Prisma setup, full schema + migration, auth (signup creates business + owner + Main Store), sessions, tenant context, permission skeleton, app shell (bottom nav + sidebar), error framework, Vitest + test DB | `feat: initialize inventory platform` |
| 2 | Products CRUD/archive/search/filter/sort/pagination, categories, brands, suppliers, barcode generation (Code 128, internal sequence), preview/download/print, multi-label print sheet | `feat: add product management`, `feat: add barcode generation`, `feat: add supplier management` |
| 3 | Stock movement engine, scanner screen (BarcodeDetector → ZXing → manual/HID), Receive, Stock Out, Adjust, onboarding wizard | `feat: add stock movement engine`, `feat: add barcode scanner` |
| 4 | Dashboard (KPIs, top movers, low stock, recent receipts/movements), per-product ledger with filters + export, low-stock screen, global search | `feat: add inventory dashboard`, `feat: add stock ledger` |
| 5 | CSV/XLSX import (validate → preview → all-or-nothing commit), CSV export, locations/racks UI, user management + roles, audit log viewer | `feat: add import export`, `feat: add roles and audit logs` |
| 6 | PWA (manifest, icons, SW, install prompt), full test suite (all items in spec §29 incl. 100 → +20 −10 −2 = 108), security headers, rate limits, index review, error-handling pass | `test: add inventory transaction tests`, `feat: add pwa support` |
| 7 | Dockerfile, docker-compose, env docs, `README`, deployment guide (Vercel + Neon/Supabase or VPS), seed/demo script, final verification | `chore: prepare production deployment` |

## 9. Explicitly out of scope for MVP (architecture leaves room)

GST invoices, POS, customers, purchase/sales orders, payments, WhatsApp, expenses, stock transfers UI (movement types already exist), accounting, GST reports, printer SDK integrations, AI features (all data needed is already in the movement ledger), subscription billing (only plan field + entitlement checks).

## 10. Assumptions (override any of these)

1. Login = email **or** mobile number + password. SMS OTP needs a paid provider → later.
2. One barcode per product, unique per business (two shops may share a manufacturer barcode).
3. Internal barcodes: Code 128, format `SF` + 8-digit per-business sequence (e.g. `SF00000042`).
4. Product images: URL field + upload abstraction (local disk in dev, S3-compatible in prod) — storage provider chosen at deployment.
5. Single default location created automatically; locations UI hidden from Staff.
6. Deployment target to be decided in Phase 7 (app is a standard Node server; works on Vercel, Railway, Render or a VPS with Docker).

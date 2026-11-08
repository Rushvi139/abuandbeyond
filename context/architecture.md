# Architecture Context

## Stack

| Layer      | Technology                              | Role |
| ---------- | --------------------------------------- | ---- |
| Framework  | Next.js 15 (App Router) + TypeScript    | One codebase: storefront, `/kitchen`, `/rider`, `/admin`, API route handlers |
| UI         | Tailwind CSS v4 + shadcn/ui             | Styling with brand tokens; accessible primitives |
| Database   | PostgreSQL 16 in our own container (`abuandbeyond-db`), `postgres` npm driver | All business data; SQL migrations in `db/migrations`, nightly dumps in `backups/` |
| Realtime   | Postgres LISTEN/NOTIFY (`orders` channel) → Server-Sent Events route | Live order board, Kitchen Display, status page |
| Auth       | Own: `staff_users` + bcrypt + httpOnly session cookie (`sessions` table) | Staff only: owner, manager, kitchen, rider. Customers never log in |
| Payments   | Cashfree PG (Orders API + Cashfree.js v3 + webhooks) | Online payment, refunds |
| Messaging  | WhatsApp Cloud API (Meta), behind `lib/whatsapp` | Template notifications, inbound auto-reply |
| Validation | Zod                                     | Every request body, webhook payload and form |
| Automation | n8n (already on the same server)        | Daily reports, low-stock alerts to WhatsApp; reads via the app's API |
| Hosting    | Own server (Hostinger VPS, shared with other apps, abuandbeyond.in): Compose project `abuandbeyond` (app + db + backup containers) behind the server's Traefik | Production. See `docs/deploy.md` |

## System Boundaries

- `src/app/(store)` — public storefront: menu, cart, checkout, order status. No auth.
- `src/app/(store)/wall`, `src/app/(store)/o/[code]/review` — public reviews wall and review form.
- `src/app/kitchen` — Kitchen Display. Role: kitchen, manager, owner.
- `src/app/rider` — rider view. Role: rider, manager, owner.
- `src/app/admin` — back office: order management (live board, manual orders, refunds), customers (CRM), properties (hotels / villas sending orders), menu, stock, vendors, purchasing, expenses, finance, reports. Role: manager, owner (finance: owner only).
- `src/app/api/cashfree/webhook` + `src/app/api/payments/verify` — the only two
  paths that mark an order paid, both of them server-side.
- `src/app/api/whatsapp` — Meta webhook (verify + inbound messages).
- `src/lib/db` — the Postgres pool (`db()`), server-only; typed query modules live beside their feature (`src/lib/menu/queries.ts`).
- `src/lib/auth` — staff login, session cookie, `requireRole()`.
- `src/lib/orders` — order state machine; the only code allowed to change `orders.status`.
- `src/lib/stock` — stock movements and recipe deduction.
- `src/lib/payments` — Cashfree wrapper (create order, fetch order, verify webhook
  signature, refund) and `markPaid`. Rupee/paise conversion lives here and nowhere else.
- `src/lib/whatsapp` — WhatsApp sender + template registry. Swappable for a BSP.
- `src/lib/pricing` — GST, totals, food-cost and margin maths.
- `db/migrations` — schema and functions (plain SQL, applied in order by `scripts/migrate.ts`). `db/seed` — CSV seed data loaded by `scripts/seed.ts`.

## Storage Model

- **Postgres**: menu, add-ons, customers, orders, order items,
  status history, payments, ingredients, recipes, stock movements, vendors,
  purchase orders, bills, vendor payments, expenses, staff profiles,
  WhatsApp message log.
- **Files** on the `uploads` Docker volume (`UPLOAD_DIR`): menu photos (`menu/`), vendor bill
  scans (`bills/`, staff only), customer review uploads (`wall/`, served only
  once approved, through an app route that checks status).
- Money is stored as integer paise (`bigint`). Quantities as `numeric(12,3)`
  in the ingredient's base unit (g, ml, pc).
- Stock on hand is derived from `stock_movements` (sum by ingredient), cached
  in a view; never edited directly.

## Auth and Access Model

- Customers are anonymous. An order is looked up by its public `order_code`
  plus phone; no customer accounts.
- Staff sign in with phone/email + password (`staff_users`, bcrypt). A
  session row + httpOnly cookie identify them; `staff_users.role` is one of
  `owner`, `manager`, `kitchen`, `rider`.
- There is no database-level row security: every server action and route
  handler calls `requireRole([...])` before touching staff data. Public routes
  (menu, checkout, order status by code + phone, review by code) expose only
  what the customer needs.
- The database is reachable only from inside the Compose network and from
  `127.0.0.1` on the server; never from the internet.

## External POS (Petpooja)

This backend is the source of truth for orders, stock and finance. Petpooja
is not connected at launch. If Petpooja is adopted later for scale, connect
it through an adapter in `src/lib/integrations/petpooja` that pushes orders
out (and pulls menu or stock only if agreed); no other module may call it.
What Petpooja's API allows must be confirmed with Petpooja first.

## Invariants

1. An order becomes `paid` only from a Cashfree webhook (or server-side
   payment verification) with a valid signature. The client is never trusted
   to say an order is paid.
2. Prices and totals are computed on the server from the database; client
   totals are display only.
3. `orders.status` changes only through `src/lib/orders/transition.ts`, which
   enforces the state machine and writes `order_status_events`.
4. Stock changes only by inserting `stock_movements` rows (purchase,
   consumption, wastage, adjustment). No direct balance updates.
5. Webhook handlers are idempotent (keyed by the gateway idempotency key / payment id or
   WhatsApp message id).
6. WhatsApp sending never blocks the order flow; failures are logged to
   `whatsapp_messages` and retried, the order continues.
7. Money is integer paise everywhere; GST 5% is applied once, at order total.
8. `DATABASE_URL` and `SESSION_SECRET` never reach the browser; the DB pool is server-only.
9. Customer-uploaded media is never shown publicly until a staff member
   approves it; only orders with status `delivered` can create a review.

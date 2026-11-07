# Code Standards

## General

- Keep modules small and single-purpose; one concern per file.
- Fix root causes, do not layer workarounds.
- Do not mix unrelated concerns in one component or route (e.g. payments and
  stock in the same handler).
- Business rules live in `src/lib/*`, not in components or route handlers.
- Name things in the business's words: order, KOT, station, indent, vendor,
  bill, pack kit.

## TypeScript

- `strict: true` throughout. No `any`; use explicit types or `unknown` +
  narrowing.
- Query with the `postgres` tagged template (`db()\`select …\``) and declare
  the row type on each query; map rows to the feature's types in the same file.
- Validate all external input with Zod at the boundary: request bodies,
  search params, form data, Razorpay and WhatsApp webhook payloads.
- Money is `number` of paise (integer). Use `formatINR(paise)` from
  `src/lib/pricing` for display. Never store or compute money as floats of
  rupees.

## Next.js

- App Router. Default to Server Components.
- Add `"use client"` only for interactivity (cart, KDS realtime, forms).
- Mutations: Server Actions for staff screens; route handlers only for
  webhooks and the public checkout API.
- Each route handler does one job, validates input first, checks role
  second, then calls a `src/lib` function.
- Realtime subscriptions live in small client hooks in
  `src/hooks/use-*.ts`.

## Styling

- Tailwind with the CSS custom property tokens in `src/app/globals.css`
  (see `ui-context.md`). No hardcoded hex values in components.
- Follow the radius scale in `ui-context.md`.
- Mobile-first for the storefront and rider view; tablet landscape for the
  Kitchen Display; desktop for admin.
- Anton only for headlines (`font-display`), Inter for everything else.

## API Routes

- Parse and validate with Zod before any logic runs; return 400 on failure.
- Enforce staff role before any mutation (`requireRole(['owner'])`).
- Webhooks: verify signature first, then idempotency check
  (`webhook_events`), then act. Always return 200 quickly once recorded.
- Response shape: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

## Data and Storage

- All business data in Postgres; schema changes only through new files in
  `db/migrations/` (never edit an applied migration; `0001_schema.sql` is
  applied on the server).
- Images and bill scans on the uploads volume; store only the relative path in Postgres.
- Order status changes only through `src/lib/orders/transition.ts`.
- Stock changes only by inserting `stock_movements`.
- Snapshot names and prices into `order_items` at order time.

## Testing

- Vitest for `src/lib` (pricing, state machine, stock deduction, webhook
  signature).
- Test the order state machine for every allowed and forbidden transition.
- Use Razorpay test mode keys and a WhatsApp test number in development.
- Local DB for tests: any Postgres 16; set `DATABASE_URL`, run `db:migrate` + `db:seed`.

## File Organization

- `src/app/(store)/` — storefront pages
- `src/app/kitchen/`, `src/app/rider/`, `src/app/admin/` — staff apps
- `src/app/api/` — webhooks and public APIs only
- `src/components/ui/` — shadcn/ui generated components (protected)
- `src/components/<area>/` — app components by area (store, kitchen, admin)
- `src/lib/` — business logic and integrations (db, orders, payments,
  whatsapp, stock, pricing)
- `src/hooks/` — client hooks (realtime, cart)
- `db/migrations/` — SQL migrations; `db/seed/` — CSV seed data
- `scripts/` — one-off scripts (seed import)
- `context/` — the spec files Claude Code works from

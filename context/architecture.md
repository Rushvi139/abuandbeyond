# Architecture Context

## Stack

| Layer      | Technology                              | Role |
| ---------- | --------------------------------------- | ---- |
| Framework  | Next.js 15 (App Router) + TypeScript    | One codebase: storefront, `/kitchen`, `/rider`, `/admin`, API route handlers |
| UI         | Tailwind CSS v4 + shadcn/ui             | Styling with brand tokens; accessible primitives |
| Database   | Supabase Postgres                       | All business data; SQL migrations in `supabase/migrations` |
| Realtime   | Supabase Realtime                       | Live order board, Kitchen Display, status page |
| Auth       | Supabase Auth (email OTP / password)    | Staff only: owner, manager, kitchen, rider. Customers never log in |
| Payments   | Razorpay (Orders API + Checkout + webhooks) | Online payment, refunds |
| Messaging  | WhatsApp Cloud API (Meta), behind `lib/whatsapp` | Template notifications, inbound auto-reply |
| Validation | Zod                                     | Every request body, webhook payload and form |
| Automation | n8n (optional, external)                | Daily reports, low-stock alerts to WhatsApp; reads via Supabase |
| Hosting    | Own server: Docker (Next.js standalone) behind Caddy (auto HTTPS); Supabase Cloud, Mumbai `ap-south-1` | Production. See `docs/deploy.md` |

## System Boundaries

- `src/app/(store)` — public storefront: menu, cart, checkout, order status. No auth.
- `src/app/(store)/wall`, `src/app/(store)/o/[code]/review` — public reviews wall and review form.
- `src/app/kitchen` — Kitchen Display. Role: kitchen, manager, owner.
- `src/app/rider` — rider view. Role: rider, manager, owner.
- `src/app/admin` — back office: order management (live board, manual orders, refunds), customers (CRM), properties (hotels / villas sending orders), menu, stock, vendors, purchasing, expenses, finance, reports. Role: manager, owner (finance: owner only).
- `src/app/api/razorpay` — create order, webhook. Only place that marks orders paid.
- `src/app/api/whatsapp` — Meta webhook (verify + inbound messages).
- `src/lib/db` — Supabase clients (browser, server, service-role) and typed queries.
- `src/lib/orders` — order state machine; the only code allowed to change `orders.status`.
- `src/lib/stock` — stock movements and recipe deduction.
- `src/lib/payments` — Razorpay wrapper (create order, verify signature, refund).
- `src/lib/whatsapp` — WhatsApp sender + template registry. Swappable for a BSP.
- `src/lib/pricing` — GST, totals, food-cost and margin maths.
- `supabase/migrations` — schema, RLS policies, functions. `supabase/seed` — CSV seed data.

## Storage Model

- **Postgres (Supabase)**: menu, add-ons, customers, orders, order items,
  status history, payments, ingredients, recipes, stock movements, vendors,
  purchase orders, bills, vendor payments, expenses, staff profiles,
  WhatsApp message log.
- **Supabase Storage**: menu item photos (`menu-images` bucket), vendor bill
  scans (`bills` bucket, private), customer review uploads (`wall-uploads`
  bucket, private until approved; approved files are served via signed or
  public copies).
- Money is stored as integer paise (`bigint`). Quantities as `numeric(12,3)`
  in the ingredient's base unit (g, ml, pc).
- Stock on hand is derived from `stock_movements` (sum by ingredient), cached
  in a view; never edited directly.

## Auth and Access Model

- Customers are anonymous. An order is looked up by its public `order_code`
  plus phone; no customer accounts.
- Staff sign in with Supabase Auth. Each staff user has a `profiles.role`:
  `owner`, `manager`, `kitchen`, `rider`.
- Row Level Security is on for every table. Anonymous users can only read
  active menu data and call the checkout API. Staff access follows role.
- Webhooks and server actions that must bypass RLS use the service-role client
  inside `src/lib/db/admin.ts` only, on the server only.

## External POS (Petpooja)

This backend is the source of truth for orders, stock and finance. Petpooja
is not connected at launch. If Petpooja is adopted later for scale, connect
it through an adapter in `src/lib/integrations/petpooja` that pushes orders
out (and pulls menu or stock only if agreed); no other module may call it.
What Petpooja's API allows must be confirmed with Petpooja first.

## Invariants

1. An order becomes `paid` only from a Razorpay webhook (or server-side
   payment verification) with a valid signature. The client is never trusted
   to say an order is paid.
2. Prices and totals are computed on the server from the database; client
   totals are display only.
3. `orders.status` changes only through `src/lib/orders/transition.ts`, which
   enforces the state machine and writes `order_status_events`.
4. Stock changes only by inserting `stock_movements` rows (purchase,
   consumption, wastage, adjustment). No direct balance updates.
5. Webhook handlers are idempotent (keyed by Razorpay event / payment id or
   WhatsApp message id).
6. WhatsApp sending never blocks the order flow; failures are logged to
   `whatsapp_messages` and retried, the order continues.
7. Money is integer paise everywhere; GST 5% is applied once, at order total.
8. The service-role key never reaches the browser.
9. Customer-uploaded media is never shown publicly until a staff member
   approves it; only orders with status `delivered` can create a review.

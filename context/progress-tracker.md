# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1 — Order and pay (not started)

## Current Goal

- A customer can browse the real menu, pay with Razorpay (test mode), and the
  order is saved as `paid` via webhook.

## Completed

- Repo set up: Next.js 15 + TypeScript + Tailwind scaffold, context files,
  brand tokens, initial Supabase migration, seed CSVs (105 dishes, 576 recipe
  lines, 129 ingredient rates) from the indent workbook and launch price list.

## In Progress

- None yet.

## Next Up

Phase 1 — Order and pay
1. Supabase project + apply migration; `scripts/seed.ts` imports
   `supabase/seed/*.csv` (categories, menu items, add-ons, ingredients,
   recipes, pack kits)
2. Brand tokens + fonts in `globals.css`; base layout
3. Storefront menu page (categories, veg filter, cuisine sticker chips)
4. Cart (client state, persisted in localStorage) + add-ons
5. Checkout form + `/api/checkout` (server-priced totals, creates customer +
   order `pending_payment` + Razorpay order)
6. Razorpay Checkout on client + `/api/razorpay/webhook` (signature,
   idempotency, mark `paid`)
7. Order status page (`/o/[code]`, realtime)
8. Staff login + admin order board (live)

Phase 2 — Kitchen and WhatsApp
9. Order state machine `src/lib/orders/transition.ts` + tests
10. Kitchen Display `/kitchen` (realtime, stations, accept, ready, chime)
11. Rider view `/rider`
12. WhatsApp sender + templates + status notifications
13. WhatsApp inbound webhook auto-reply

Phase 3 — Stock and purchasing
14. Ingredients, recipes, stock on hand, low-stock alerts
15. Auto-deduct on delivered; wastage + adjustments
16. Vendors, purchase orders (indents), goods received

Phase 4 — Finance
17. Vendor bills + payments, dues
18. Expenses
19. Daily summary + monthly P&L + cost % vs 33% ceiling + CSV export

Phase 5 — WhatsApp ordering
20. Catalogue in chat + Razorpay payment link into the same pipeline

## Open Questions

- Final menu: the launch price list has 105 dishes + 2 add-ons; the Setup
  Tracker menu sheet lists 43 items, some not costed (Pesto Rice, Chicken
  Nuggets, Honey Dragon Chicken, Pizza Marcos, Ravioli, Avocado Cheese Roll,
  Tiramisu, Lal Maas, Handi Chicken). Which list goes live?
- Pizza size: costed at 7–8"; packaging is a 12" box. Re-price if 12".
- Delivery fee and delivery radius (all of Mount Abu? minimum order?)
- Opening hours and last-order time (late night per the brand: "11 pm")
- Intro offer code (e.g. 15% off above ₹499 for 3–4 weeks)?
- WhatsApp: direct Cloud API or a BSP (Interakt / AiSensy / Gupshup)?
- Is there a KOT printer (model, Bluetooth/USB) or screen only?
- Recipe quantities: the rate card gives quantity per dish for each
  ingredient name; a few recipe lines use names that differ from the rate
  card (e.g. "BBQ sauce/seasoning"). Confirm units during seed import.

## Architecture Decisions

- Next.js + Supabase + Razorpay + WhatsApp Cloud API, hosted on Vercel —
  one codebase, realtime KDS without extra servers, low cost at launch.
- Money stored as integer paise; prices stored before 5% GST (standalone
  restaurant rate, no input credit) — matches the margin strategy.
- Orders become live only via the Razorpay webhook — avoids ghost orders
  from closed browser tabs.
- Stock is an event ledger (`stock_movements`) — gives an audit trail and
  lets food-cost % be computed from real consumption.
- Customers are anonymous (phone number only) — tourists won't create
  accounts.

## Session Notes

- Supabase region: Mumbai (`ap-south-1`).
- Seed sources: `Abu_and_Beyond_Indent_List 2.xlsx` (recipes, rate card,
  ingredient groups) and `Launch price list.pdf` (prices, packaging per
  category).

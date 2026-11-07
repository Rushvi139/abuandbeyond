# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1 — Order and pay (not started)

## Current Goal

- A customer can browse the real menu, pay with Razorpay (test mode), and the
  order is saved as `paid` via webhook.

## Completed

- Repo set up: Next.js 15 + TypeScript + Tailwind scaffold, context files,
  brand tokens, initial Supabase migration, seed CSVs (576 recipe lines,
  129 ingredient rates) from the indent workbook and launch price list.
- Live launch menu locked (7 Nov 2026): 31 items in `supabase/seed/menu_items.csv`
  across Pizza, Pasta, Laffa Rolls, Bowls, Burgers, Fries, Garlic Bread,
  Iced Tea, Shakes. Migration `20261107000000_item_options.sql` adds item
  options (bowl base, fries flavour) and `price_status`.

## In Progress

- None yet.

## Next Up

Phase 1 — Order and pay
1. Supabase project + apply migrations; `scripts/seed.ts` imports
   `supabase/seed/*.csv`: categories, the 31 live menu items, options
   (from the `options` column, format `Group:choice|choice`), add-ons,
   ingredients, pack kits, and recipe lines for each item's `costing_ref`
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
13. WhatsApp inbound webhook auto-reply (menu link, track, reorder last order)
13x. Reorder in WhatsApp: delivered message's "Order again" sends a
     Razorpay `order_details` payment request in the chat; paid → same pipeline

Phase 2c — Back office CRM
13e. Migration `20261107020000_crm.sql` (done as file, apply)
13f. Customers list + customer detail (history, spend, tags, notes)
13g. Properties + per-property QR codes + orders by property
13h. Manual order entry → WhatsApp payment link

Phase 2b — Reviews and wall
13a. Migration `reviews` + `review_media` + `wall-uploads` bucket (done as file, apply)
13b. `/o/[code]/review` form with uploads (delivered orders only)
13c. `/admin/wall` moderation queue
13d. `/wall` public page + social links

Phase 3 — Stock and purchasing
14. Ingredients, recipes, stock on hand, low-stock alerts
15. Auto-deduct on delivered; wastage + adjustments
16. Vendors, purchase orders (indents), goods received

Phase 4 — Finance
17. Vendor bills + payments, dues
18. Expenses
19. Daily summary + monthly P&L + cost % vs 33% ceiling + CSV export

Phase 5 — Full WhatsApp ordering (deferred)
20. Catalogue + cart inside WhatsApp. Start only if, after 4–6 weeks,
    more than ~25% of orders begin in the WhatsApp chat rather than the QR.
    Needs: Meta catalogue sync, bowl/fries choices as separate SKUs or
    follow-up buttons, physical-goods fields on `order_details`.

## Open Questions

- Does Petpooja offer an API for pushing online orders in? Ask them before
  we plan any sync.
- Photoshoot after site lock: 31 dishes, 1:1, drop style (see ui-context).

- Social links: Instagram handle, Google Business review link, WhatsApp
  business number for the `/wall` buttons.

- Prices for the 6 new dishes are provisional until their recipes are
  costed: Veggies Pizza ₹349, Pesto Pizza ₹379, Alfredo Pasta ₹269,
  Mac & Cheese ₹249, Mexican Hotpot (Chicken) ₹289, Blue Lagoon ₹99.
- 7 "matched" dishes use a close costed dish's recipe (see `costing_ref`);
  confirm the recipe is the same: Roasted Chicken / Paneer / Veggies Laffa,
  Thai Chilly Chicken Bowl, Thai Paneer Chilly Bowl, Butter Chicken +
  Biryani Rice, Falafel Hummus Platter.
- Chicken Burger sits at 60% gross margin and Paneer Laffa at 62%; recipe
  fixes or a price change?
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

- Next.js + Supabase + Razorpay + WhatsApp Cloud API — one codebase,
  realtime KDS without extra servers, low cost at launch.
- Self-hosted on our own server (Docker + Caddy); Supabase stays on its
  cloud (Mumbai) for managed backups, realtime and auth (7 Nov 2026).
- Own back office is the system of record at launch; Petpooja deferred
  (setup-heavy, meant for scale) and would connect later via an adapter.
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
- Server: Hostinger VPS 93.127.166.70; domain abuandbeyond.com; repo
  github.com/Rushvi139/abuandbeyond. Deploy steps in `docs/deploy.md`.
- Screens approved for build are on the "Abu & Beyond — Order App Screens"
  canvas: ordering = 3 screens (/, /checkout, /o/[code]); item options are
  a bottom sheet on /.
- Live menu = 31 items (user list, 7 Nov 2026). Cuisine sticker per item is
  in the CSV; Laffa rolls are tagged ABU & LEBANON.
- Seed sources: `Abu_and_Beyond_Indent_List 2.xlsx` (recipes, rate card,
  ingredient groups) and `Launch price list.pdf` (prices, packaging per
  category).

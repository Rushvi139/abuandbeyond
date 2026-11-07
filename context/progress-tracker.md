# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1 — Order and pay (in progress: units 1–4 done)

## Current Goal

- Unit 5: checkout form + `/api/checkout` (server-priced totals, customer +
  order `pending_payment`, Razorpay order).

## Completed

- 7 Nov: Supabase dropped. Own Postgres 16 container (`abuandbeyond-db`) +
  nightly `pg_dump` container; `db/migrations/0001_schema.sql` (whole
  schema, LISTEN/NOTIFY on orders, views); `scripts/migrate.ts`,
  `scripts/seed.ts`; `docker compose run --rm migrate` applies + seeds.
- 7 Nov, Phase 1 units 1–4: menu query (`src/lib/menu`), storefront menu
  screen (`components/store/menu-screen.tsx`: categories, veg filter,
  sticker tiles, options sheet, add-ons, kitchen note, qty, sticky cart bar),
  cart in localStorage (`hooks/use-cart.ts`), `/checkout` placeholder
  showing the bag + GST. Brand PNG logos, sticker-sheet cutouts in
  `public/brand/stickers/`. First-visit leopard entrance + welcome card
  (`components/store/welcome.tsx`); `HappyBear` ready for the confirmed
  screen. Verified in a phone-size browser.

- Repo set up: Next.js 15 + TypeScript + Tailwind scaffold, context files,
  brand tokens, initial migration, seed CSVs (576 recipe lines,
  129 ingredient rates) from the indent workbook and launch price list.
- Live launch menu locked (7 Nov 2026): 31 items in `db/seed/menu_items.csv`
  across Pizza, Pasta, Laffa Rolls, Bowls, Burgers, Fries, Garlic Bread,
  Iced Tea, Shakes, with item options (bowl base, fries flavour) and
  `price_status`. All of it now lives in `db/migrations/0001_schema.sql`.

## In Progress

- None. Next session starts unit 5.

## Next Up

Phase 1 — Order and pay
1. ~~DB + migrations + seed~~ done
2. ~~Brand tokens + fonts + layout~~ done
3. ~~Storefront menu page~~ done
4. ~~Cart + add-ons~~ done
5. Checkout form + `/api/checkout` (server-priced totals, creates customer +
   order `pending_payment` + Razorpay order)
6. Razorpay Checkout on client + `/api/razorpay/webhook` (signature,
   idempotency, mark `paid`)
7. Order status page (`/o/[code]`, live via SSE) with `HappyBear` dancing
   under the "Order #… is in." header
8. Staff login (`src/lib/auth`: bcrypt, session cookie, `requireRole`) +
   admin order board (live via SSE)

Phase 2 — Kitchen and WhatsApp
9. Order state machine `src/lib/orders/transition.ts` + tests
10. Kitchen Display `/kitchen` (realtime, stations, accept, ready, chime)
11. Rider view `/rider`
12. WhatsApp sender + templates + status notifications
13. WhatsApp inbound webhook auto-reply (menu link, track, reorder last order)
13x. Reorder in WhatsApp: delivered message's "Order again" sends a
     Razorpay `order_details` payment request in the chat; paid → same pipeline

Phase 2c — Back office CRM
13e. CRM tables (`properties`, customer tags/notes, order attribution) are in
     `0001_schema.sql` already
13f. Customers list + customer detail (history, spend, tags, notes)
13g. Properties + per-property QR codes + orders by property
13h. Manual order entry → WhatsApp payment link

Phase 2b — Reviews and wall
13a. `reviews` + `review_media` tables are in `0001_schema.sql`; add the
     `wall/` upload folder handling
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

- Next.js + Postgres + Razorpay + WhatsApp Cloud API — one codebase,
  live KDS through Postgres LISTEN/NOTIFY, low cost at launch.
- Fully self-hosted (7 Nov 2026): app + Postgres + backup containers on
  the Hostinger VPS behind Traefik. No Supabase: fewer moving parts, data
  stays on our server, realtime via Postgres LISTEN/NOTIFY + SSE.
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

- Server: Hostinger VPS 93.127.166.70 (Traefik, `root_default` network);
  domain abuandbeyond.in; repo github.com/Rushvi139/abuandbeyond; app in
  `/opt/abuandbeyond`. Deploy steps in `docs/deploy.md`.
- Local testing: a throwaway Postgres 16 on port 5433 works with
  `DATABASE_URL=postgres://postgres@localhost:5433/abuandbeyond`.
- Open: closing-time label on the menu header (`closingLabel` prop) is
  null until opening hours are decided.
- Screens approved for build are on the "Abu & Beyond — Order App Screens"
  canvas: ordering = 3 screens (/, /checkout, /o/[code]); item options are
  a bottom sheet on /.
- Live menu = 31 items (user list, 7 Nov 2026). Cuisine sticker per item is
  in the CSV; Laffa rolls are tagged ABU & LEBANON.
- Seed sources: `Abu_and_Beyond_Indent_List 2.xlsx` (recipes, rate card,
  ingredient groups) and `Launch price list.pdf` (prices, packaging per
  category).

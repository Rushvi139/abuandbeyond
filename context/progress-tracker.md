# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1 done (needs Razorpay keys on the server to take real test payments); Phase 2 kitchen/rider/CRM done; WhatsApp (units 12–13) next

## Current Goal

- Unit 12: WhatsApp sender + templates + status notifications (then 13:
  inbound auto-reply + reorder).

## Completed

- 7 Nov (late 2): back office extended — `/admin/menu` add/edit/remove
  dishes with photo upload, choices and add-ons; `/admin/stock` inventory
  (on hand from the movement ledger, purchase/wastage/count/opening,
  add/edit ingredients, low-stock flag once a reorder level is set);
  `/admin/accounts` (owner only: daily ledger from sales/bills/expenses,
  month picker, vendor bills with attachment + payments + dues, expenses);
  kitchen "AI batching" toggle (`components/admin/batching.tsx`: groups the
  same dish across live tickets, rules-based). Uploads served from
  `/files/<folder>/…` (`UPLOAD_DIR`; menu public, bills/wall staff only).
  Migrations 0002 (vendor name unique), 0003 (low-stock rule).
- Leopard: procedural rigged silhouette (`components/store/leopard.tsx`)
  is the interim entrance; a photoreal/illustrated continuous animation
  needs a video asset (see Open Questions).

- 7 Nov (late): Phase 1 units 5–8 and Phase 2 units 9–11 + 13e–13g:
  - `/checkout` real form + `/api/checkout` (Zod, server-priced from DB,
    required options enforced, customer upsert, property attribution via
    `?src=`), Razorpay order + Checkout.js, `/api/razorpay/verify`
    (checkout-handler HMAC) and `/api/razorpay/webhook` (HMAC, idempotent
    via `webhook_events`, `payment.captured` / `order.paid` / `payment.failed`).
  - `src/lib/orders/transition.ts` state machine (+ tests), stock deduction
    on delivered; `src/lib/orders/actions.ts` server actions (accept with
    prep time, status steps by role, assign rider, cancel + Razorpay refund).
  - `/o/[code]` live status page (SSE via Postgres LISTEN/NOTIFY →
    `/api/events/order/[code]`), with `HappyBear`.
  - Staff auth (`src/lib/auth`: bcrypt, sessions table, httpOnly cookie,
    `requireRole`/`assertRole`), `/login`, `scripts/create-staff.ts`
    (`npm run staff`).
  - `/admin` live order board + today stats + history search; `/kitchen`
    dark KDS with station filter + chime; `/rider` view.
  - CRM: `/admin/customers` (search, sort by spend/orders), customer detail
    (stats, favourites, tags, notes, WhatsApp opt-in, order history);
    `/admin/properties` (add/edit, per-property QR generated locally,
    orders + revenue per property); `/admin/menu` (sold-out toggle, price
    edit, gross margin incl. packaging, social links form).
  - DB driver parses bigint as number (money bug fixed).

- 7 Nov: Supabase dropped. Own Postgres 16 container (`abuandbeyond-db`) +
  nightly `pg_dump` container; `db/migrations/0001_schema.sql` (whole
  schema, LISTEN/NOTIFY on orders, views); `scripts/migrate.ts`,
  `scripts/seed.ts`; `docker compose run --rm migrate` applies + seeds.
- 7 Nov, Phase 1 units 1–4: menu query (`src/lib/menu`), storefront menu
  screen (`components/store/menu-screen.tsx`: categories, veg filter,
  sticker tiles, options sheet, add-ons, kitchen note, qty, sticky cart bar),
  cart in localStorage (`hooks/use-cart.ts`), `/checkout` placeholder
  showing the bag + GST. Brand PNG logos, sticker-sheet cutouts in
  `public/brand/stickers/`. First-visit leopard character entrance (walk → pounce → prowl → sit,
  per the reference reel) + welcome card (`components/store/welcome.tsx`); `HappyBear` ready for the confirmed
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
5. ~~Checkout + /api/checkout~~ done
6. ~~Razorpay Checkout + verify + webhook~~ done (untested against real
   Razorpay until keys are set; webhook URL must be registered)
7. ~~Order status page~~ done
8. ~~Staff login + admin order board~~ done

Phase 2 — Kitchen and WhatsApp
9. ~~State machine + tests~~ done
10. ~~Kitchen Display~~ done
11. ~~Rider view~~ done
12. WhatsApp sender + templates + status notifications
13. WhatsApp inbound webhook auto-reply (menu link, track, reorder last order)
13x. Reorder in WhatsApp: delivered message's "Order again" sends a
     Razorpay `order_details` payment request in the chat; paid → same pipeline

Phase 2c — Back office CRM
13e–g. ~~CRM tables, customers, properties~~ done
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

- Leopard entrance (user wants the YE Garba reel feel: character comes
  down from the top, settles on the logo with a leg hanging, realistic
  illustrated look, continuous motion). Needs an animation asset: an AI
  video on a flat green background (Canva paid plan / Higgsfield credits /
  the tool that made the user's 9-frame GIF), keyed out and played as a
  transparent overlay positioned on the logo; or a 2D puppet rig by an
  animator. Current silhouette rig is a placeholder.

- Razorpay: register the webhook at `https://abuandbeyond.in/api/razorpay/webhook`
  with events payment.captured, order.paid, payment.failed; paste the
  webhook secret into `.env`.
- Opening hours / closing label; delivery fee is `settings.delivery_fee_paise`
  (0 now).

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

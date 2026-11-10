# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1 done (needs Razorpay keys on the server to take real test payments); Phase 2 kitchen/rider/CRM done; WhatsApp (units 12–13) next

## Current Goal

- Unit 12: WhatsApp sender + templates + status notifications (then 13:
  inbound auto-reply + reorder).

## Completed

- 10 Nov (wait game): the catch-the-food game on the order page replaced with
  "Over the ridge" — one tap to flap, granite stacks to fly through, set on
  the Mount Abu skyline from the logo. Own art and physics, nothing borrowed.
  The ceiling is a soft stop rather than a hazard, and each gap sits within
  92px of the last, so a miss is always the player's and never the game's.
  The play button is now solid acid rather than a dashed outline — it was
  invisible against the rest of the page.

- 10 Nov (pay on delivery): Cashfree isn't activated, so the checkout dead-ended
  on "online payment isn't switched on yet". Cash or UPI to the rider at the
  door is now a full payment path: the order is confirmed and cooked at once,
  while the money is recorded separately when the rider actually has it
  (`orders.payment_mode`, `collected_at`, `collected_by`; a `payments` row with
  gateway `on_delivery` so it reconciles like an online payment). Collecting is
  limited to rider/manager/owner and to orders that have left the kitchen — a
  cook tapping it would put cash in the books that nobody is holding. The
  kitchen screen, the KOT and the guest's own page all say *not paid* until it
  is collected, and the guest's page reads "Pay ₹X at the door", never "Paid".
  Accounts grows a "To collect" tile. The `cod_enabled` setting (dead since
  0001) now switches cash off once Cashfree is live, with a toggle on /admin;
  with no gateway it stays on regardless, so the shop can never end up taking
  no orders at all.
  **A UPI deep link or QR was considered and rejected**: UPI intents have no
  callback, so nothing would confirm the money arrived and staff would verify
  every payment by eye. Revisit only with a real UPI collect API.

- 8 Nov (new logo): brand kit of 8 Nov 2026 dropped in across the app — the
  hand-drawn lopsided ridge with Guru Shikhar on the left, the smaller tilted
  Jost ampersand, the wider 1.4:1 patch and the ink footer bar. Every lockup
  refitted to the new ratio (the old one was near-square, so heights were
  wrong), the full favicon set wired up including .ico and apple-touch, and
  new `patch-acid-reverse`, `monogram-ab-ridge-ink` and `ampersand-glyph-clay`
  added. Jost is deliberately **not** in the font stack: it lives only inside
  the logo artwork, which ships as PNG. The leopard entrance was re-checked
  against the wider patch and still lands on the top edge.
- 8 Nov (deploy trap, fixed): the `migrate` service sits in a Docker profile, and
  `compose up --build` does not rebuild profiled services — so `run --rm migrate`
  kept using an image built on day one that contained only `0001_schema.sql`,
  reporting "migrations up to date" while applying nothing. The server ran nine
  migrations behind the code. `db/` and `scripts/` are now bind-mounted into the
  migrate container at run time, and the script prints how many files it found
  against how many are applied, so a mismatch is visible.
- 8 Nov (recipe book): `/admin/recipes` — every dish with its photos, method
  (one step per line), chef's notes, prep time and yield, on top of the
  ingredient lines that already drive costing and stock. Quantities are edited
  in place and the cost recalculates: ingredients + kitchen loading % +
  packaging, against the price, with the margin flagged under 60%. Dishes with
  no recipe are called out, since they cost nothing and take nothing off the
  shelf when they sell. The book closes the loop to the indent: 30 days of real
  orders run back through the recipes gives what was actually eaten by
  ingredient, against what is on the shelf, ordered by value.
- 8 Nov (logins): staff sign in with a **username** (phone and email still work).
- 8 Nov (contact): Public number **+91 8628910887** seeded into settings, so Help
  shows working WhatsApp and Call buttons and a real Contact Us block. A contact
  email can be added alongside it in the back office (Menu → Contact & social).
  Cashfree's domain whitelisting needs Contact Us, Terms and Refunds pages —
  all three are live.
- 8 Nov (entrance + policies): The entrance now plays on a real arrival or
  refresh only — tapping back to the menu from Help or Account no longer
  replays it. Logo and leopard sit in one scene that starts pulled back and
  zooms in as the leopard walks, so they can never drift apart; the film swaps
  to the still 300ms before the card slides, which was the stutter.
  The card carries Help, Terms, Privacy and Refunds links, and
  `/terms`, `/privacy` and `/refunds` now exist — Cashfree requires Contact,
  Terms and Refunds pages before they will whitelist the domain.
- 8 Nov (payments): **Razorpay replaced with Cashfree.** Server creates the order
  and hands the browser only a short-lived `payment_session_id`; Cashfree.js v3
  opens the modal; the order is marked paid only by the signature-verified
  webhook (`/api/cashfree/webhook`, base64 HMAC over timestamp + raw body) or by
  our own server-side re-check (`/api/payments/verify`) when the guest returns.
  Refunds are keyed by order with an id we generate, recorded in a new `refunds`
  table. `payments.razorpay_*` columns are now `gateway_*`. 16 tests pass,
  including money conversion and four ways a bad signature must be rejected.
  Not yet tested against Cashfree's sandbox — their hosts are blocked from the
  build container, so the first live test happens on the server.
- 8 Nov (strip): Banners can now run as a **thin strip across the very top** of
  every guest page as well as the big cards — short headline, optional button
  words and link, colour, and a festive-lights or paw-print motif. Several
  strips take turns every five seconds. Both kinds live together on `/admin/menu`.
- 8 Nov (later): Veg **and** non-veg filters on the menu; swipeable **banners**
  across the top (offers / new dishes, with optional photo and a date window,
  managed on `/admin/menu`); **catering enquiries** from the help page into
  `/admin/catering` with a new → quoted → confirmed → closed status; and
  `/rider/bills`, a market-run screen where a rider files vendor bills and cash
  expenses (with the paper photographed) without seeing sales or margins —
  every bill now records who filed it.
- 8 Nov: The bhalu on the order screen is now a rendered film too — sitting with
  one of our orange-wrapped rolls, eating and swaying, looping on transparency
  (WebM / WebP / still, same approach as the leopard).
- 8 Nov: Guest side filled out — bottom tabs (Menu / Cart / Account / Help) on
  every guest screen; **My account** (`/account`) with name, number, lifetime
  spend, order history and one-tap *Order again* (re-prices the old order at
  today's menu); finding your orders on a new phone with mobile + any past order
  number (a signed `ab_guest` cookie, set the moment you check out — to be
  replaced by a WhatsApp one-time code); **Help** (`/support`) with WhatsApp,
  call and the FAQs; **Shop** (`/merch`) teasing keychains, magnets, t-shirts and
  caps with a waiting list (`merch_interest`). Dish sheets now lead with a full
  photo when one is uploaded. Add-ons are managed on `/admin/menu` (create once,
  attach by name to any dish).
- 7 Nov (late 3): CSV exports — `/admin/export/<report>` (route handler,
  role-checked): `stock` (full ingredient list with on-hand, reorder level,
  rate, stock value), `stock-ledger` (movements for a month), and owner-only
  `ledger`, `bills`, `expenses`, `orders` (`?month=YYYY-MM`). Buttons on the
  Inventory, Accounts and Orders pages. Money in rupees (2 dp), dates
  `YYYY-MM-DD`, times IST, UTF-8 BOM so Excel opens them cleanly.
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

- Demo orders (8 Nov 2026): `createDemoOrder()` in `src/lib/orders/demo.ts`
  inserts a paid order against a real Mount Abu property so the whole
  kitchen → rider → delivered flow can be walked end to end. Demos carry
  `is_demo` and are excluded from every sales, costing and indent query,
  and skip the stock consumption insert on delivery. `clearDemoOrders()`
  removes them and any customer left orphaned.
- Delivery pin (8 Nov 2026): `<LocationPin>` on checkout, optional,
  captured with accuracy; `lat`/`lng` ride through to the rider card.
- Rider run map (8 Nov 2026): `runUrl()` builds one Google Maps
  directions link for the whole round — kitchen as origin, each stop a
  waypoint, two-wheeler mode. Pinned stops route by coordinates, the rest
  by "<property>, <landmark>, Mount Abu".
- Stay directory (8 Nov 2026): `stays` table plus `/rider/stays` (search
  by name, zone or landmark; distance from the kitchen; tap to call or
  navigate) and `/admin/stays` (CSV import, zone counts, import history).
  Loaded from `mount_abu_full_sweep.py`, which sweeps Google Places over
  the plateau. Keyed on `place_id`, so a re-sweep updates rather than
  duplicates, and never overwrites a hand-written note, a QR link or the
  active flag. Kept separate from `properties` on purpose — see the
  migration's header comment.

- Accounts, second pass (8 Nov 2026): expenses can carry a photo of the
  slip (`expenses.file_path`, served through `/files/` behind the staff
  session, same as bill invoices). A **Vendors** table per month — billed,
  cash spends, paid, still owed — where "still owed" is every unpaid bill
  whenever it was raised, not just this month's, and overdue is flagged red.
  A **Where it went** panel ranking vendor bills by vendor against expense
  categories, since both come out of the same till. Stat row now carries
  Paid out and Still owed as separate numbers. `/admin/accounts/vendors/[id]`
  holds one vendor's invoices, payments with UTRs, cash spends, a
  month-by-month strip, and a count of bills with no invoice attached.
  New `vendors` CSV export.
- Fixed while there: a vendor payment could exceed the bill's outstanding
  amount (now locked and checked); and `PayBill` discarded the action's
  error, so a rejection looked like nothing happening — it returns the
  message as a value, since Next masks thrown server-action messages in
  production.

- Registers (9 Nov 2026): `/admin/accounts/expenses` groups spending by
  week (Mon–Sun, last eight weeks by default) with a bar and subtotal per
  week, filtered by date range, category, vendor, mode and free text.
  `/admin/accounts/vendors` is the bill register — unpaid first, soonest
  due at the top, overdue tinted — filtered by status, vendor, dates and
  bill number. Both edit a cell at a time with optimistic rollback, and
  collapse to one tappable line per row on a phone.
  - Editable columns are matched against a fixed whitelist in
    `register-actions.ts` before any SQL, because a column name cannot be
    a bound parameter and `field` arrives from the browser.
    `register-actions.test.ts` is what holds that line — do not loosen it.
  - Migration 0014 adds `updated_at`/`updated_by` to expenses and
    vendor_bills; rows show "edited by <name>".
  - Guards: an expense can't be blanked or zeroed; a bill can't be cut
    below what's been paid against it; deleting is owner-only and refuses
    a bill with payments.
- Watch for: optional date filters must use `nullif(param, '')::date`,
  never `param = '' or col >= param::date`. Postgres does not promise to
  short-circuit OR, so the blank still reaches the cast and throws.

- Editable everywhere (9 Nov 2026): ingredient name, group, reorder level
  and rate are cells on /admin/stock; vendor name, trade, contact, phone,
  email, GSTIN, terms and notes are cells on the vendor page. Rates are
  typed per kg/L/pc and stored per g/ml/pc, matching `saveIngredient` —
  the test pins ₹240/kg -> 24 paise/g, and that arithmetic must not drift.
  A rename checks for a clash, since the ledger groups vendors by name.
- DEPLOY.md written: the commands, why `migrate` is a separate step,
  telling a stale tools image from a stale file set, rollback, restore,
  and what each volume holds.
- The nightly backup now tars the `uploads` volume alongside the pg_dump.
  Invoices and slips live there, not in Postgres.
- Dropped `NEXT_PUBLIC_RAZORPAY_KEY_ID` from Dockerfile and compose —
  unused since the Cashfree migration.
- Watch for: a grid whose fixed columns exceed the container collapses its
  `1fr` to nothing and overlaps text. Give the flexible column a
  `minmax()` floor and wrap the table in `overflow-x-auto`.

- KOT (9 Nov 2026): `/kitchen/kot/[id]` is one ticket for an 80 mm
  thermal roll — no prices, big order number, notes boxed. Per-screen
  auto-print toggle (off by default, localStorage) plus a Print KOT
  button per card. Double printing is prevented by a conditional update
  on `orders.kot_printed_at`, not by anything the browser remembers;
  two concurrent claims were tested and exactly one wins.
- Coupons (9 Nov 2026): `/admin/coupons` for percent or flat codes with
  minimum order, date window, total and per-customer limits, and
  first-order-only. Checkout has a code box; `/api/coupon` only previews.
  The rules that must not be loosened:
  - GST is charged on the DISCOUNTED value (`gstOn(subtotal - discount)`).
  - A discount is clamped to the bill, so a total can never go negative.
  - A percentage coupon must have `max_discount_paise`; the form refuses
    to save one without it.
  - The order transaction re-checks the coupon and locks the coupon row;
    the browser's discount is never read.
  - Redemptions count only orders NOT in pending_payment / payment_failed
    / cancelled, so an abandoned checkout doesn't burn someone's code.
  - Unknown and switched-off codes return the same message on purpose.
  `coupons.test.ts` pins the arithmetic.
- Remarks (9 Nov 2026): `expenses.note` and `vendor_bills.note`, editable
  in both registers; `orders.kitchen_note` for a line staff add for the
  kitchen, shown on the card and at the top of the ticket.

- SEO + indexing (10 Nov 2026): the site was not in Google at all — no
  robots.txt, no sitemap, no structured data. Added `src/app/robots.ts`
  (staff, checkout, account and order pages disallowed), `src/app/sitemap.ts`,
  `metadataBase` + Open Graph/Twitter cards with `public/brand/og-image.png`
  (the locked patch logo on bone), a keyword-led home title, Restaurant
  JSON-LD on `/` built live from the menu (`src/lib/seo.ts`), and noindex
  layouts on every staff/personal route. Seven server-rendered keyword
  landing pages at `/[landing]` from `src/lib/seo-pages.ts` (keyword map in
  its header): food delivery, late night, pizza, pasta, burgers, Lebanese,
  shakes — each lists live dishes and links back to the menu. Canonical is
  set per page, never in the layout (it would be inherited by every page).
  Fixed the pre-existing `<a>`→`<Link>` lint errors on /kitchen and /rider
  that were failing `npm run build`.

### WhatsApp order notifications (outbox + Cloud API) — built, not yet live

- Guests have no login, so the order page stays the source of truth and
  WhatsApp is how they are reached when the tab is closed.
- `transition()` calls `notifyOrderStatus` after the commit. It queues, never
  sends: rows in `whatsapp_messages` (migration 0023), one per
  `(order_id, kind)` — a repeated transition cannot message twice. Demo and
  opted-out customers get nothing. Pay-on-delivery orders also get
  `collect_at_door` with the amount before the rider arrives.
- `POST /api/whatsapp/dispatch` (x-internal-secret) drains the queue; the
  `whatsapp` compose service calls it every 30s. Failures retry with backoff,
  5 attempts, then `failed`. Unconfigured, rows are written as `skipped`.
- Four UTILITY templates live in `src/lib/whatsapp/templates.ts`
  (`npm run wa:templates` prints them for WhatsApp Manager). The review
  button is `https://g.page/r/{{1}}` because Meta needs a fixed base.
- Admin order card keeps a `wa.me` click-to-chat button, which works with the
  normal WhatsApp app and needs no API.
- Bug found while verifying: payload was stored as a JSON *string*, which
  would have sent templates with no variables. Now `sql.json`.

### WhatsApp inbound (unit 13) — built, not yet live

- `GET/POST /api/whatsapp/webhook`: verify-token handshake; POST rejected
  unless `X-Hub-Signature-256` matches `WHATSAPP_APP_SECRET`. Always 200 after
  that so Meta never replays a poison message.
- Guest messages stored as `direction='in'` (migration 0024, unique provider
  id = Meta's retries are no-ops). Replies are queued through the same outbox:
  TRACK → latest order link, "same again" → last order's items + menu link,
  anything else → menu, hours, how to track. STOP / START flip
  `customers.whatsapp_opt_in`. Max 5 replies per number per 10 minutes.
- Delivery receipts move our sent rows on to delivered / read / failed, never
  backwards.
- Reorder is a text summary plus the menu link, not a pre-filled cart.

### Menu feed: Title Case, price order, arrangeable sections

- Guest menu shows Title Case names (categories, dishes, option and add-on
  names) and sentence-case descriptions, whatever case /admin holds
  (`src/lib/text.ts`, applied in `getMenu`). Category names are also
  Title-Cased on save so "pizza" and "Pizza" cannot become two sections.
- Inside a section dishes run cheapest first (then by name); admin list too.
- /admin/menu has "Order of sections on the menu" with up/down arrows
  (`moveCategory`, renumbers 1..n then swaps). The seed no longer rewrites
  category positions unless `SEED_OVERWRITE=1`, so a deploy keeps the order.
- Section headings keep the brand display type (uppercase by style).

## In Progress

- None.

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
13. ~~WhatsApp inbound webhook auto-reply (menu link, track, reorder last order)~~ built — see Completed; needs Meta setup (DEPLOY.md)
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

- WhatsApp go-live (owner): submit the 4 templates in WhatsApp Manager and
  wait for approval; create a system-user permanent token; set
  `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` in the server `.env`;
  then `./deploy.sh` to start the `whatsapp` service. Until then every row is
  `skipped` and nothing is sent. First real send needs the owner's go-ahead.
- Not started, needs confirming: a WhatsApp one-time-code (or magic-link)
  order lookup to replace phone + order number, and a pre-filled reorder cart.

- SEO, owner-side: verify abuandbeyond.in in Google Search Console (DNS TXT
  record at the domain registrar), submit /sitemap.xml, and create the Google
  Business Profile (delivery-only = service-area business). Add the GBP
  review link to Menu → Contact & social. Optional env:
  `GOOGLE_SITE_VERIFICATION` for the HTML-tag method.

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
- The `migrate` service is in the `tools` Docker profile, and
  `compose up --build` skips profiled services. A stale tools image once
  kept reporting "migrations up to date" while running a day-one file set.
  `db/` and `scripts/` are now bind-mounted so the files are read from the
  checkout at run time; after pulling new migrations, run
  `docker compose --profile tools build migrate` if the image looks old.
- `places.googleapis.com` is not on the egress allowlist, from either the
  cloud container or the desktop bridge, so the Mount Abu sweep has to be
  run on the owner's own machine and the CSV imported at /admin/stays.

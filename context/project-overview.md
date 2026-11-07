# Abu & Beyond — Ordering + Kitchen ERP

## Overview

One web app that runs Abu & Beyond end to end. Tourists in Mount Abu hotels,
villas and homestays scan a QR, order from the menu, pay with Razorpay and get
WhatsApp updates. The kitchen works from a live Kitchen Display (KOTs), the
rider from a phone view, and the owner from an internal ERP covering orders,
stock, vendors and finances.

Abu & Beyond is a delivery-only global kitchen (Italian, Mexican, Lebanese,
Chinese, burgers, rolls) at Bhagyaraj House, near Hotel Hillock, Mount Abu.
It runs its own delivery rider. Tagline: "Beyond the usual."

## Goals

1. Handle 2,000+ orders in the first month with zero orders lost between
   payment and kitchen.
2. Every paid order reaches the Kitchen Display within 5 seconds; the customer
   gets a WhatsApp confirmation within 1 minute.
3. Keep food + packaging cost at or below 33% of net sales, visible daily
   (target 68% gross margin per dish).
4. Owner closes each day with a one-screen summary: orders, revenue, average
   ticket, food + packaging %, low stock.

## Routes and Screens

Ordering takes three screens on a phone. Designs: "Abu & Beyond — Order App
Screens" canvas (claude.ai artifact) — build against it.

| Route | Screen | Who |
| --- | --- | --- |
| `/` | 1 · Menu: categories, veg filter, cart bar. Item options open as a bottom sheet (no page change) | Customer |
| `/checkout` | 2 · Cart + delivery details + bill + Pay (Razorpay) on one page | Customer |
| `/o/[code]` | 3 · Order confirmed + live status, chat / call buttons | Customer |
| `/o/[code]/review` | Rate, review, upload photos or a reel (delivered orders only; link sent on WhatsApp) | Customer |
| `/wall` | Reviews wall: rating summary, approved photos and reels, reviews, social links | Anyone |
| `/kitchen` | Kitchen Display (KOTs) | Kitchen |
| `/rider` | Deliveries | Rider |
| `/admin` | Orders, menu, stock, vendors, finance | Owner, manager |
| `/admin/wall` | Approve or reject reviews' media before they show on `/wall` | Owner, manager |

Rules: no customer login; no separate cart page; no separate item page;
every screen works one-handed at 360 px width; the primary action is always a
sticky bottom button.

## Core User Flow

1. Customer scans a QR (hamper, hotel desk, hoarding, sticker) and lands on the
   menu. No login.
2. Browses by category and cuisine, filters veg / non-veg, adds items and
   add-ons (extra cheese ₹59, egg ₹29).
3. Checkout: name, WhatsApp number, stay type (hotel / villa / homestay /
   home), property name, room or landmark, optional map pin.
4. Pays with Razorpay Checkout (UPI, card, wallet). No cash on delivery at
   launch.
5. Razorpay webhook (signature verified) marks the order `paid`. Only paid
   orders become live.
6. Customer sees the order status page and receives a WhatsApp confirmation.
7. Kitchen Display shows the KOT with a chime; cook taps Accept (sets prep
   time), then Ready.
8. Rider sees Ready orders, taps Picked up, then Delivered.
9. Each status change sends a WhatsApp update. Delivered deducts recipe
   ingredients from stock and closes the order.
10. Owner sees everything on the order board and the daily summary.

Order status machine (the only allowed transitions):

```
pending_payment → paid → accepted → preparing → ready → out_for_delivery → delivered
pending_payment → payment_failed
paid | accepted | preparing → cancelled (owner only; triggers refund)
```

## Features

### Storefront (customer, mobile-first)

- Menu by category with cuisine sticker tags (ABU & ITALY / MEXICO / CHINA /
  LEBANON / ABU), veg / non-veg markers and filter
- Item add-ons, cart, order notes
- Sold-out-today toggle respected in real time
- Delivery details form (see flow), GST 5% shown as a bill line
- Order status page (live)
- Brand look per `ui-context.md`

### Payments (Razorpay)

- Server creates a Razorpay order for the cart total
- Razorpay Checkout on the client
- Webhook `payment.captured` / `order.paid` verifies the signature and marks
  the order paid (idempotent)
- Owner can refund a paid order from the admin

### WhatsApp

- Template messages: order confirmed, preparing, out for delivery, delivered,
  reorder nudge
- Inbound auto-reply with menu link and order tracking link
- "Reorder" button in the delivered message: sends a Razorpay payment
  request for the same order inside the chat (Phase 2)
- Inbound "Hi" auto-reply: menu link, track order, reorder last order
- Later (only if demand): catalogue + cart ordering inside WhatsApp

### Kitchen Display (KDS)

- Live KOT cards (order no., time since paid, items grouped by station, notes,
  cuisine sticker)
- Stations: Pizza & Oven, Wok & Momos, Grill & Rolls, Fryer, Cold & Drinks
- Accept (with prep time), Ready; chime on new order; printable KOT

### Rider view

- Ready orders with address, map link, tap-to-call
- Picked up → Delivered

### Reviews and wall

- After delivery, WhatsApp sends a "Rate & share" link to `/o/[code]/review`
  (one review per delivered order — keeps reviews genuine)
- Review: 1–5 stars, quick tags (Hot & fresh, On time, Packaging, Portion
  size, Value), optional text, up to 4 photos or 1 video (60 s, 50 MB),
  optional Instagram handle for credit, consent checkbox to be featured
- Uploads go to a private storage bucket; owner approves or rejects in
  `/admin/wall`; only approved media appear on `/wall`
- Review text is shown as written, never edited by staff; owner can hide a
  review only for abuse or spam
- `/wall` shows average rating and count from real reviews, approved photos
  and reels, latest reviews, and buttons to Instagram, Google review page and
  WhatsApp chat

### Owner / back office (our own CRM + ERP; replaces Petpooja at launch)

- Order board: live orders by status, search, cancel + refund, assign rider
- Manual orders: staff enter a phone or WhatsApp order, the system sends the
  customer a Razorpay payment link in WhatsApp; it joins the same pipeline
- Customers (CRM): every customer by phone with name, order count, total
  spend, first and last order, favourite dishes, tags (tourist, local,
  repeat), notes, WhatsApp opt-in; order history per customer
- Properties: hotels, villas and homestays that orders come from; orders and
  revenue per property; per-property QR codes (`/?src=<property>`) to see
  which hotels send guests
- Menu admin: items, prices (pre-GST), availability, add-ons
- Stock: ingredients, units, reorder levels, recipes per dish, auto-deduct on
  delivery, wastage and manual adjustments, low-stock alerts
- Vendors & purchasing: vendors, indents (purchase orders), goods received
  (updates stock + latest rate), bills, payments, dues
- Finance: expenses by category, daily and monthly revenue, food + packaging
  cost % vs 33% ceiling, P&L, CSV export
- Daily summary screen

## Scope

### In Scope

- Customer web ordering + Razorpay + WhatsApp notifications
- Kitchen Display, rider view, owner order board
- Stock, recipes, vendors, purchasing, expenses, revenue, P&L
- Reviews, customer photo/video uploads with moderation, `/wall` page
- Seed data from the indent workbook and launch price list

### Out of Scope (for now)

- Dine-in, table ordering
- Cash on delivery
- Zomato / Swiggy integration (if listed, priced 20–25% higher, managed outside)
- Petpooja integration (later, through an adapter, if the business moves to it)
- Full ordering inside the WhatsApp chat (catalogue + cart): deferred until
  data shows demand; see progress-tracker
- Loyalty points, coupons beyond a simple intro-offer code
- Native mobile apps (the web app is installable as a PWA later)
- Multi-outlet support

## Success Criteria

1. A customer can scan a QR, order, pay on Razorpay (test mode) and receive a
   WhatsApp confirmation with no staff action.
2. A paid order appears on the Kitchen Display within 5 seconds and moves
   through every status, each change messaging the customer.
3. Marking an order Delivered deducts its recipe ingredients from stock; an
   ingredient below its reorder level shows a low-stock alert.
4. A vendor bill and payment can be logged and appear in the monthly P&L next
   to revenue.
5. The daily summary shows food + packaging cost % for the day.
6. A customer with a delivered order can leave a review with a photo from
   the WhatsApp link; after owner approval it appears on `/wall`.
7. Placing an order takes at most 3 screens from the QR scan.

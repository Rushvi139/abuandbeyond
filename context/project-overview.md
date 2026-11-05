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
- Phase 5: catalogue ordering inside WhatsApp with a Razorpay payment link

### Kitchen Display (KDS)

- Live KOT cards (order no., time since paid, items grouped by station, notes,
  cuisine sticker)
- Stations: Pizza & Oven, Wok & Momos, Grill & Rolls, Fryer, Cold & Drinks
- Accept (with prep time), Ready; chime on new order; printable KOT

### Rider view

- Ready orders with address, map link, tap-to-call
- Picked up → Delivered

### Owner / ERP

- Order board: live orders by status, search, cancel + refund, assign rider
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
- Seed data from the indent workbook and launch price list

### Out of Scope (for now)

- Dine-in, table ordering
- Cash on delivery
- Zomato / Swiggy integration (if listed, priced 20–25% higher, managed outside)
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

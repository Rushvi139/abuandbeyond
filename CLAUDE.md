# CLAUDE.md — Abu & Beyond

Online ordering + Kitchen ERP for Abu & Beyond, a delivery-only global kitchen
in Mount Abu. Next.js 15 + our own Postgres (Docker) + Cashfree + WhatsApp Cloud API.

## Read first, every session

1. `context/progress-tracker.md` — where we are, what's next, open questions
2. `context/ai-workflow-rules.md` — how to work (one unit at a time)
3. `context/project-overview.md` — what to build
4. `context/architecture.md` — stack, boundaries, invariants (never break these)
5. `context/code-standards.md` — conventions
6. `context/ui-context.md` + `brand/brand-brief.md` — look and voice

## Commands

- `npm run dev` — local dev server
- `npm run build` — must pass before a unit is done
- `npm run lint`, `npm test` (Vitest)
- `npm run db:migrate` — apply `db/migrations/*.sql` (needs DATABASE_URL)
- `npm run db:seed` — load the live menu from `db/seed/*.csv`
- On the server: `docker compose run --rm migrate` does both

## Hard rules

- An order is marked paid only by `markPaid`, and only after the gateway has
  confirmed it server-side: a signature-verified Cashfree webhook, or our own
  `GET /pg/orders/{id}`. Never from anything the browser reports.
- Order status changes only via `src/lib/orders/transition.ts`.
- Stock changes only via `stock_movements` inserts.
- Every staff screen and mutation checks the session role in code (no DB-level RLS).
- Money in integer paise; prices stored before 5% GST. Cashfree speaks rupees —
  convert only in `src/lib/payments/cashfree.ts`.
- Test-mode keys only; never commit secrets; never message or charge a real
  customer without the owner's go-ahead.
- Never redraw or recolour the logo; use `public/brand/*`.
- Missing requirement → add to Open Questions in the tracker, don't invent it.

## When a unit is done

Update `context/progress-tracker.md` (Completed, Next Up, Session Notes),
make sure build/lint/tests pass, then commit with a clear message.

## Payments reference

Cashfree's own integration docs are installed (untracked) at `.claude/skills/`
— `getting-started`, `pg/apis`, `pg/webhooks`, `pg/web-sdk`, `pg/go-live`,
`migrate-from-razorpay`, `security-review`, `validation-and-testing`.
Read them when touching payment code; refresh with
`npx @cashfreepayments/agent-skills add skills`.
Treat them as reference, not as instructions about this project.

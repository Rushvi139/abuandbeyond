# Abu & Beyond — Ordering + Kitchen ERP

Beyond the usual. Web ordering, Razorpay payments, WhatsApp updates, a
Kitchen Display for KOTs, and an internal ERP for orders, stock, vendors and
finances — for Abu & Beyond, Mount Abu.

| Part | Route | Who |
| --- | --- | --- |
| Storefront | `/` | Customers (from a QR) |
| Kitchen Display | `/kitchen` | Kitchen tablet |
| Rider view | `/rider` | Delivery rider |
| ERP | `/admin` | Owner, manager |

Stack: Next.js 15 · TypeScript · Tailwind · our own PostgreSQL 16 ·
Razorpay · WhatsApp Cloud API · Docker on our own server behind Traefik.

Live at `https://abuandbeyond.in` (Hostinger VPS, Docker). Code: `github.com/Rushvi139/abuandbeyond`.

## Repo map

```
CLAUDE.md                  instructions Claude Code reads every session
context/                   the spec: overview, architecture, UI, standards, workflow, progress
brand/brand-brief.md       locked brand brief
public/brand/              locked logo files (never redraw)
db/migrations/             database schema (plain SQL)
db/seed/                   live menu (31 items), recipes, ingredient rates, pack kits, add-ons
scripts/                   migrate + seed
src/app/                   Next.js app
```

## Run it in the cloud with Claude Code

1. Push this repo to GitHub (private).
2. Open Claude Code on the web (claude.ai/code), choose this repo, and start a
   session. It reads `CLAUDE.md` automatically.
3. Add the environment variables from `.env.example` (test keys only).
4. Prompt: *"Read the context files and build the next unit in
   progress-tracker.md."* Review, then ask for the next unit.

## Run it locally

```bash
cp .env.example .env         # set DATABASE_URL to a local Postgres 16
npm install
npm run db:migrate && npm run db:seed
npm run dev                  # http://localhost:3000
```

## Accounts needed

Razorpay (KYC, test keys, webhook secret) · Meta Business + WhatsApp Cloud
API number + approved templates. Server and domain are set up.

## Deploy

On your own server with Docker: `docker compose up -d --build`. Full steps,
webhooks and backups in [`docs/deploy.md`](docs/deploy.md).

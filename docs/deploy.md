# Deploying on your own server

The app runs in Docker on your server, behind Caddy (automatic HTTPS). The
database, realtime and staff login stay on Supabase Cloud (Mumbai region), so
backups and the live Kitchen Display need no server work from you.

## Server

- Ubuntu 22.04/24.04, 2 vCPU, 2–4 GB RAM is enough to start (one kitchen,
  ~100 orders a day). Pick a data centre in Mumbai for speed.
- Docker + Docker Compose installed.
- Ports 80 and 443 open.
- Your domain's A record pointing at the server's IP.

## First deploy

```bash
git clone git@github.com:<you>/abu-and-beyond.git && cd abu-and-beyond
cp .env.example .env          # fill in; add DOMAIN=yourdomain.in
docker compose up -d --build  # builds the app, Caddy fetches the certificate
```

Open `https://<your domain>`. Then:

1. Razorpay webhook → `https://<domain>/api/razorpay/webhook`
2. WhatsApp webhook → `https://<domain>/api/whatsapp/webhook` (verify token = `WHATSAPP_VERIFY_TOKEN`)
3. Apply database migrations from your laptop: `npx supabase link` then `npx supabase db push`

## Updates

```bash
git pull && docker compose up -d --build
```

## Good habits

- Keep `.env` only on the server; never commit it.
- Turn on Supabase's daily backups (Project settings → Database).
- Add an uptime check (e.g. a free monitor hitting `/` every minute) so you
  hear about downtime before customers do.

## Optional: fully self-hosted database

Supabase can also run on your own server with Docker. It is heavier (about
10 containers, you handle backups and upgrades), so start on Supabase Cloud
and move only if you need to.

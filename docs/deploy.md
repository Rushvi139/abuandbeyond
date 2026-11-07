# Deploying on your own server

The app runs in Docker on your server, behind Caddy (automatic HTTPS). The
database, realtime and staff login stay on Supabase Cloud (Mumbai region), so
backups and the live Kitchen Display need no server work from you.

## Our setup

| Item | Value |
| --- | --- |
| Server | Hostinger VPS, IP `93.127.166.70` |
| Domain | `abuandbeyond.com` (`www.abuandbeyond.com` redirects to it) |
| Code | `github.com/Rushvi139/abuandbeyond` |

### DNS (at your domain registrar or Hostinger DNS)

| Type | Name | Points to |
| --- | --- | --- |
| A | `@` | `93.127.166.70` |
| A | `www` | `93.127.166.70` |

Remove any other A or AAAA records for `@` and `www` (parking pages), or
the HTTPS certificate will fail.

### One-time server prep (as root over SSH)

```bash
ssh root@93.127.166.70
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh          # Docker + Compose plugin
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
adduser deploy && usermod -aG docker deploy      # run the app as a non-root user
```

If the GitHub repo is private, add a deploy key: on the server run
`ssh-keygen -t ed25519` as `deploy`, then paste `~/.ssh/id_ed25519.pub` into
GitHub → repo → Settings → Deploy keys (read-only).

## Server

- Ubuntu 22.04/24.04, 2 vCPU, 2–4 GB RAM is enough to start (one kitchen,
  ~100 orders a day). Pick a data centre in Mumbai for speed.
- Docker + Docker Compose installed.
- Ports 80 and 443 open.
- Your domain's A record pointing at the server's IP.

## First deploy

```bash
git clone git@github.com:Rushvi139/abuandbeyond.git && cd abuandbeyond
cp .env.example .env          # fill in; DOMAIN=abuandbeyond.com
docker compose up -d --build  # builds the app, Caddy fetches the certificate
```

Open `https://abuandbeyond.com`. Then:

1. Razorpay webhook → `https://abuandbeyond.com/api/razorpay/webhook`
2. WhatsApp webhook → `https://abuandbeyond.com/api/whatsapp/webhook` (verify token = `WHATSAPP_VERIFY_TOKEN`)
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

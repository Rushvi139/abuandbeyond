# Deploying on our Hostinger server

The app runs as its own Docker container, separate from the other apps on
the server. The database, realtime and staff login stay on Supabase Cloud
(Mumbai region), so backups and the live Kitchen Display need no server work.

| Item | Value |
| --- | --- |
| Server | Hostinger VPS, IP `93.127.166.70` (shared with other apps) |
| Domain | `abuandbeyond.in` (`www.abuandbeyond.in` redirects to it) |
| Code | `github.com/Rushvi139/abuandbeyond` |
| Folder on server | `/opt/abuandbeyond` |
| Container | `abuandbeyond-app`, on `127.0.0.1:3100` (change with `APP_PORT`) |

## 1. DNS (done in Hostinger DNS)

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `93.127.166.70` |
| A | `www` | `93.127.166.70` |

## 2. Find out what already serves your other apps

Something on the server already answers ports 80/443. Check which:

```bash
ssh root@93.127.166.70
sudo ss -tlnp | grep -E ':80 |:443 '                       # which program holds 80/443
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
sudo ss -tlnp | grep ':3100 '                              # must print nothing (port free)
```

- `nginx` → use step 4A
- a `caddy` container or service → 4B
- `traefik` → 4C
- a control panel (CloudPanel, Coolify, Easypanel, aaPanel…) → 4D
- nothing on 80/443 → 4E

If 3100 is taken, pick another free port and set `APP_PORT` in `.env`
(and in the proxy config).

## 3. Put the app in its own folder and start it

```bash
sudo mkdir -p /opt/abuandbeyond && sudo chown $USER /opt/abuandbeyond
git clone https://github.com/Rushvi139/abuandbeyond.git /opt/abuandbeyond
cd /opt/abuandbeyond
cp .env.example .env && nano .env      # fill in keys; NEXT_PUBLIC_SITE_URL=https://abuandbeyond.in
docker compose up -d --build           # starts only abuandbeyond-app
curl -I http://127.0.0.1:3100          # should answer HTTP 200
```

Private repo? Add a read-only deploy key (`ssh-keygen -t ed25519`, paste the
`.pub` into GitHub → repo → Settings → Deploy keys) and clone with
`git@github.com:Rushvi139/abuandbeyond.git`.

The Compose project is named `abuandbeyond`, so its container, network and
volumes never clash with your other apps.

## 4. Connect the domain to the container

### 4A. Nginx

```bash
sudo cp deploy/nginx-abuandbeyond.in.conf /etc/nginx/sites-available/abuandbeyond.in
sudo ln -s /etc/nginx/sites-available/abuandbeyond.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d abuandbeyond.in -d www.abuandbeyond.in
```

### 4B. Existing Caddy

Add to its Caddyfile, then reload Caddy:

```
www.abuandbeyond.in {
	redir https://abuandbeyond.in{uri} permanent
}
abuandbeyond.in {
	reverse_proxy 127.0.0.1:3100
}
```

If that Caddy runs in Docker, `127.0.0.1` means its own container: put both on
one Docker network and use `reverse_proxy abuandbeyond-app:3000` instead.

### 4C. Traefik

Join the app to Traefik's network and add labels to the `app` service:

```yaml
    labels:
      - traefik.enable=true
      - traefik.http.routers.abuandbeyond.rule=Host(`abuandbeyond.in`) || Host(`www.abuandbeyond.in`)
      - traefik.http.routers.abuandbeyond.entrypoints=websecure
      - traefik.http.routers.abuandbeyond.tls.certresolver=<your resolver>
      - traefik.http.services.abuandbeyond.loadbalancer.server.port=3000
```

### 4D. Control panel

Add a new site for `abuandbeyond.in` (and `www`) as a reverse proxy to
`http://127.0.0.1:3100`, then turn on its free SSL (Let's Encrypt).

### 4E. Nothing else on 80/443

`docker compose --profile caddy up -d --build` — the bundled Caddy handles
HTTPS for `DOMAIN` (set `DOMAIN=abuandbeyond.in` in `.env`).

## 5. After it is live

1. Open `https://abuandbeyond.in`.
2. Razorpay webhook → `https://abuandbeyond.in/api/razorpay/webhook`
3. WhatsApp webhook → `https://abuandbeyond.in/api/whatsapp/webhook` (verify token = `WHATSAPP_VERIFY_TOKEN`)
4. Apply database migrations from your laptop: `npx supabase link`, then `npx supabase db push`

## Updates

```bash
cd /opt/abuandbeyond && git pull && docker compose up -d --build
```

This rebuilds only `abuandbeyond-app`; your other apps keep running.

## Good habits

- Keep `.env` only on the server; never commit it.
- Turn on Supabase daily backups (Project settings → Database).
- Add an uptime check on `https://abuandbeyond.in` so you hear about downtime first.
- Watch memory: the app needs about 300–500 MB at runtime; the build step
  briefly needs ~1.5 GB. If the server is tight, build on GitHub Actions and
  pull the image instead (ask Claude to set this up).

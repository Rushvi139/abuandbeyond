# Deploying on our Hostinger server

Everything runs in our own containers, separate from the other apps on the
server: the app, its PostgreSQL database and a nightly backup job.

| Item | Value |
| --- | --- |
| Server | Hostinger VPS, IP `93.127.166.70` (shared with other apps) |
| Domain | `abuandbeyond.in` (`www.abuandbeyond.in` redirects to it) |
| Code | `github.com/Rushvi139/abuandbeyond` |
| Folder on server | `/opt/abuandbeyond` |
| Containers | `abuandbeyond-app` (127.0.0.1:3100), `abuandbeyond-db` (127.0.0.1:5433), `abuandbeyond-backup` |
| Backups | `/opt/abuandbeyond/backups/*.sql.gz`, one a day, kept 14 days |

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
cp .env.example .env && nano .env      # NEXT_PUBLIC_SITE_URL, POSTGRES_PASSWORD, SESSION_SECRET (see file)
docker compose up -d --build           # app + db + backup
docker compose run --rm migrate        # create tables and load the menu
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

### 4C. Traefik (our server: `root-traefik-1`)

The repo ships `docker-compose.traefik.yml`. Confirm Traefik's names first:

```bash
docker inspect root-traefik-1 -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker inspect root-traefik-1 -f '{{join .Config.Cmd "\n"}}' | grep -E 'entrypoints\.|certificatesresolvers\.' | head
docker inspect advino-app -f '{{json .Config.Labels}}'
```

Put the matching values in `.env`:

```
COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml
TRAEFIK_NETWORK=root_default
TRAEFIK_ENTRYPOINT=websecure
TRAEFIK_CERTRESOLVER=mytlschallenge
```

Then `docker compose up -d --build`. Traefik picks up the labels, gets the
certificate for `abuandbeyond.in`, and redirects `www` to it.

### 4D. Control panel

Add a new site for `abuandbeyond.in` (and `www`) as a reverse proxy to
`http://127.0.0.1:3100`, then turn on its free SSL (Let's Encrypt).

### 4E. Nothing else on 80/443

`docker compose --profile caddy up -d --build` — the bundled Caddy handles
HTTPS for `DOMAIN` (set `DOMAIN=abuandbeyond.in` in `.env`).

## 5. After it is live

1. Open `https://abuandbeyond.in`.
2. Cashfree webhook → `https://abuandbeyond.in/api/cashfree/webhook`
   (Dashboard → Payment Gateway → Developers → Webhooks, version `2025-01-01`),
   and whitelist `abuandbeyond.in` under Developers → Whitelist Domain
3. WhatsApp webhook → `https://abuandbeyond.in/api/whatsapp/webhook` (verify token = `WHATSAPP_VERIFY_TOKEN`)
4. Create the first staff login (owner), then one per cook / rider:

   ```bash
   docker compose run --rm migrate npm run staff -- --name "Rushvi" --phone 98xxxxxxxx --role owner --password 'a-long-password'
   docker compose run --rm migrate npm run staff -- --name "Cook 1" --phone 98xxxxxxxx --role kitchen --password '...'
   docker compose run --rm migrate npm run staff -- --name "Rider 1" --phone 98xxxxxxxx --role rider --password '...'
   ```

   Staff sign in at `https://abuandbeyond.in/login` (owner/manager → `/admin`, kitchen → `/kitchen`, rider → `/rider`).
5. Cashfree keys in `.env` (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`,
   `CASHFREE_ENV=sandbox` or `production`), then `docker compose up -d --build`.
   When you add the webhook endpoint the dashboard makes you generate a token —
   put it in `CASHFREE_WEBHOOK_SECRET`. A webhook is accepted if it matches that
   token or the API secret, so whichever Cashfree signs with, it works.
   Sandbox and production use different hosts, so `CASHFREE_ENV` must change too.

## Uploads

Menu photos and bill attachments live on the `uploads` Docker volume
(`/data/uploads` inside the app container). Back it up with the database:
`docker run --rm -v abuandbeyond_uploads:/u -v $PWD/backups:/b alpine tar czf /b/uploads-$(date +%F).tgz -C /u .`

## Updates

```bash
cd /opt/abuandbeyond && git pull && docker compose up -d --build && docker compose run --rm migrate
```

This rebuilds only our containers; your other apps keep running. `migrate`
is safe to run every time: it applies only new migrations and re-syncs the
menu seed.

`migrate` reads `db/` and `scripts/` from the checkout at run time, so it is
always current even though `compose up --build` skips profiled services.
It prints how many migration files it found and how many are applied — if
those two numbers differ from what is in `db/migrations/`, the pull did not
land. To check the database directly:

```bash
docker compose exec db psql -U abu -d abuandbeyond -c "select count(*) from schema_migrations"
```

## Good habits

- Keep `.env` only on the server; never commit it.
- Backups land in `/opt/abuandbeyond/backups/`; copy them off the server weekly
  (`scp` to your laptop or a cloud drive). Restore: `gunzip -c <file> | docker compose exec -T db psql -U abu abuandbeyond`.
- Database access from your laptop: `ssh -L 5433:127.0.0.1:5433 root@93.127.166.70`, then connect to `localhost:5433`.
- Add an uptime check on `https://abuandbeyond.in` so you hear about downtime first.
- Watch memory: the app needs about 300–500 MB at runtime; the build step
  briefly needs ~1.5 GB. If the server is tight, build on GitHub Actions and
  pull the image instead (ask Claude to set this up).

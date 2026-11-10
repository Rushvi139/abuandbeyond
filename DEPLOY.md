# Deploying Abu & Beyond

The app runs on the Hostinger VPS at `/opt/abuandbeyond`, behind the Traefik
that already fronts the other sites on that box. Everything is in Docker, so a
deploy is a pull and a rebuild.

## The usual deploy

SSH to the VPS, then:

```sh
cd /opt/abuandbeyond
./deploy.sh
```

That takes a backup first, pulls, rebuilds, migrates, and checks the site
answers before telling you it worked. The app keeps serving while the new
image builds; the swap at the end costs a few seconds.

By hand, if you prefer:

```sh
docker compose run --rm backup-now     # dump + uploads tarball, right now
git pull
docker compose up -d --build
docker compose run --rm migrate        # schema only
```

## What a deploy does to your data

**Nothing, except add to the schema.** This is worth being precise about,
because for one day it was not true.

| Step | Touches your data? |
|---|---|
| `git pull`, `up --build` | No. Code and images only; the database is a volume. |
| `run --rm migrate` | Adds tables and columns. Each migration runs once ever, in its own transaction, recorded in `schema_migrations`. |
| `run --rm seed` | **Yes — only run it on purpose.** |

Orders, customers, expenses, vendor bills, stays, coupons, stock movements and
uploaded invoices are never written by a deploy. Keep typing into `/admin` and
keep deploying; the two do not collide.

### The seed is not part of a deploy

`docker compose run --rm seed` loads `db/seed/*.csv`. It used to run inside the
`migrate` service, which meant **every deploy reset menu prices, add-on prices
and ingredient rates to the CSV** — four times in one day before anyone
connected a price "not saving" to having just deployed.

Now it is its own command, and even when you run it the file no longer wins:
anything editable in `/admin` (name, category, station, cuisine, veg flag,
price, packaging; add-on price; ingredient group, unit, rate) is left exactly
as the kitchen set it. Only new rows and fields with no editor — pack kits,
costing references, sort order — come from the file.

Run it when you have **added dishes to the CSV**. You do not need it otherwise.

To deliberately push the CSV over live values — a real bulk price change —
`docker compose run --rm -e SEED_OVERWRITE=1 seed`. Take a backup first; that
command is the one thing here that can undo an evening of edits.

### Changing a price

In `/admin` → Menu. That is the source of truth now, and it survives deploys.
Change `db/seed/menu_items.csv` as well if you want a fresh database to start
from the new price, but editing the CSV alone changes nothing on the server.

### Why `migrate` is a separate command

`migrate` sits in the `tools` Compose profile, and **`up --build` does not touch
profiled services**. That is the point — it also means `up --build` will never
run migrations for you, so the second command is not optional when a release
adds one. It is safe to run when there is nothing new; it prints what it did:

```
migrations up to date (14 on disk, 14 applied)
```

If it reports fewer applied than on disk, it is about to apply the difference.
If it claims to be up to date but the app is erroring on a missing column, the
tools *image* is stale rather than the files — rebuild it once:

```sh
docker compose --profile tools build migrate
docker compose run --rm migrate
```

(This bit us in November 2026: migrations sat at 0001 for a day while the
command cheerfully reported success.)

## Checking it worked

```sh
docker compose ps                      # app, db, backup all "running"
docker compose logs --tail=40 app      # no stack traces
curl -sI https://abuandbeyond.in | head -1      # HTTP/2 200
```

Then open the site, place nothing, and just check the staff side loads:
`/login` → Accounts → Expenses. If a page 500s, `docker compose logs app` names
the column or table that is missing, which almost always means the migrate step
was skipped.

## Rolling back

Images are rebuilt from the checkout, so rolling back is a checkout:

```sh
cd /opt/abuandbeyond
git log --oneline -5
git checkout <the commit before>
docker compose up -d --build
```

**Migrations do not roll back.** They are written to be additive — new tables,
new nullable columns — so an older app keeps working against a newer database.
Do not write a migration that drops or renames a column in use without a
two-step plan, or this stops being true.

That additive rule is what makes a code rollback safe on its own: the old image
simply ignores the new column. If a release ever does need the database rolled
back too, that is the pre-deploy dump in `./backups/predeploy-*`, and it costs
you every order taken since — so prefer rolling the code back and fixing
forward.

## What lives where

| Thing | Where | Survives a rebuild? |
|---|---|---|
| Database | `pgdata` volume | yes |
| Bill invoices, expense slips, dish photos | `uploads` volume, served by `/files/` | yes |
| Nightly backups | `./backups` on the host | yes |
| The app itself | image, rebuilt each deploy | n/a |

The `backup` container dumps Postgres **and** tars the uploads volume once a
day, keeping `BACKUP_KEEP_DAYS` (default 14), and `backup-now` takes the same
pair on demand — which is what `deploy.sh` does before it changes anything, so
the fallback is a dump from a minute ago rather than from last night. A database-only backup would
restore the books with every receipt gone, which is why both are taken.

Pull a copy down to your Mac now and then:

```sh
scp 'root@<vps>:/opt/abuandbeyond/backups/*' ~/Backups/abuandbeyond/
```

### Restoring

Tested end to end on 10 Nov: dump, drop the database, restore. All orders,
expenses, bills and stays came back, `schema_migrations` came back with them,
and the next `run --rm migrate` was a no-op rather than re-running everything
from 0001 — which is the part that would hurt.

```sh
gunzip -c backups/abuandbeyond-2026-11-09_0200.sql.gz | \
  docker compose exec -T db psql -U abu -d abuandbeyond

docker run --rm -v abuandbeyond_uploads:/u -v "$PWD/backups:/b" alpine \
  sh -c 'tar xzf /b/abuandbeyond-uploads-2026-11-09_0200.tar.gz -C /u'
```

## Environment

`.env` on the server is the source of truth and is not in git; `.env.example`
lists every key. After editing it, `docker compose up -d` (no `--build`) is
enough for runtime values. A `NEXT_PUBLIC_*` value is baked in at build time, so
changing one needs `--build`.

Before taking real money, rotate everything that has ever been pasted into a
chat or a ticket: `POSTGRES_PASSWORD`, `SESSION_SECRET`, and the Cashfree keys.
Rotating `SESSION_SECRET` signs every staff member out, which is fine, and
invalidates the `ab_guest` cookie, which only means returning customers lose
their order history link — not their orders.

## Cashfree

`CASHFREE_ENV=sandbox` until go-live. The webhook endpoint is
`https://abuandbeyond.in/api/cashfree/webhook`; the dashboard makes you generate
a per-endpoint token for it, which goes in `CASHFREE_WEBHOOK_SECRET`. The API
secret is accepted too, because the docs and the dashboard disagree about which
one signs.

Nothing is live until a payment has actually gone through. Sandbox UPI
`testsuccess@gocash` is the two-minute version of that test.

## WhatsApp (Meta Cloud API)

Order updates and replies go through the Cloud API; nothing sends until these
are in the server `.env` (then `./deploy.sh`):

| Variable | Where it comes from |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Manager → API setup |
| `WHATSAPP_ACCESS_TOKEN` | a **system-user permanent token** (not the 24-hour test token) |
| `WHATSAPP_VERIFY_TOKEN` | any long random string you invent; paste the same one into Meta |
| `WHATSAPP_APP_SECRET` | Meta app → Settings → Basic → App secret |

1. Submit the four templates (`npm run wa:templates` prints them) and wait for approval.
2. In the Meta app → WhatsApp → Configuration, set the callback URL to
   `https://abuandbeyond.in/api/whatsapp/webhook`, the verify token above, and
   subscribe to the **messages** field. Meta calls it once to check the token.
3. The webhook rejects any request whose signature does not match the app
   secret, so an unset `WHATSAPP_APP_SECRET` means replies are refused, by design.

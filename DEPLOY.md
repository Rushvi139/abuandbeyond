# Deploying Abu & Beyond

The app runs on the Hostinger VPS at `/opt/abuandbeyond`, behind the Traefik
that already fronts the other sites on that box. Everything is in Docker, so a
deploy is a pull and a rebuild.

## The usual deploy

SSH to the VPS, then:

```sh
cd /opt/abuandbeyond
git pull
docker compose up -d --build
docker compose run --rm migrate
```

That is it. The app keeps serving while the new image builds; the swap at the
end costs a few seconds.

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

## What lives where

| Thing | Where | Survives a rebuild? |
|---|---|---|
| Database | `pgdata` volume | yes |
| Bill invoices, expense slips, dish photos | `uploads` volume, served by `/files/` | yes |
| Nightly backups | `./backups` on the host | yes |
| The app itself | image, rebuilt each deploy | n/a |

The `backup` container dumps Postgres **and** tars the uploads volume once a
day, keeping `BACKUP_KEEP_DAYS` (default 14). A database-only backup would
restore the books with every receipt gone, which is why both are taken.

Pull a copy down to your Mac now and then:

```sh
scp 'root@<vps>:/opt/abuandbeyond/backups/*' ~/Backups/abuandbeyond/
```

### Restoring

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

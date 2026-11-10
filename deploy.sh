#!/bin/sh
# Deploy, without putting the day's orders at risk.
#
#   ./deploy.sh
#
# Order matters. The backup is taken before anything changes, so if a
# migration turns out to be wrong there is a dump from one minute earlier
# rather than from last night. Nothing here loads the menu CSV: that is
# `docker compose run --rm seed`, run deliberately, because it is the one
# thing that can overwrite what you typed into /admin.
set -eu

cd "$(dirname "$0")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/5  Backing up the database and the uploaded bills"
docker compose run --rm backup-now

say "2/5  Fetching the new code"
before=$(git rev-parse --short HEAD)
git pull --ff-only
after=$(git rev-parse --short HEAD)
if [ "$before" = "$after" ]; then
  echo "already at $after — nothing new to deploy"
else
  echo "$before -> $after"
  git --no-pager log --oneline "$before..$after" | sed 's/^/    /'
fi

say "3/5  Building and restarting"
docker compose up -d --build

say "4/5  Applying database migrations"
docker compose run --rm migrate

say "5/5  Checking the site answers"
ok=0
i=0
while [ "$i" -lt 30 ]; do
  code=$(docker compose exec -T app sh -c 'wget -qS -O /dev/null http://localhost:3000/ 2>&1 | awk "/HTTP\//{print \$2; exit}"' 2>/dev/null || true)
  if [ "$code" = "200" ]; then ok=1; break; fi
  i=$((i + 1))
  sleep 2
done

if [ "$ok" = "1" ]; then
  say "Deployed. The menu CSV was not touched — prices and rates are as you left them."
else
  printf '\n\033[1;31mThe site did not answer 200 after a minute.\033[0m\n'
  echo "Logs:            docker compose logs --tail=50 app"
  echo "Roll the code back: git reset --hard $before && docker compose up -d --build"
  echo "The pre-deploy dump is in ./backups/ if the database needs restoring (see DEPLOY.md)."
  exit 1
fi

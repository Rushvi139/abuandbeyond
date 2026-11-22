#!/bin/sh
# The 22 Nov 2026 release, in one go, with a stop before the menu changes.
#
#   ./scripts/release-2026-11-22.sh
#
#  1. ./deploy.sh: backup, new code, rebuild (about a minute of restart),
#     database updates, health check. Stops here if the site doesn't answer.
#  2. Shows what the two menu scripts would do to YOUR live menu (nothing is
#     changed), and saves it in release-logs/.
#  3. Asks. Only "YES" applies them. Anything else stops with the menu as it was.
#
# The vendor-bills cleanup is NOT part of this; it stays a separate preview.
set -eu
cd "$(dirname "$0")/.."

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
psqlf() { docker compose exec -T db psql -U abu -d abuandbeyond "$@"; }

bold "STEP 1 of 3: deploying the new code"
./deploy.sh

# The 20 Nov pizza script resets its pizzas' and burgers' prices, names and
# add-ons each time it runs, so it runs only if it never has (no PZ12 yet).
done_before=$(psqlf -Atc "select count(*) from menu_items where sku = 'PZ12'" | tr -d '[:space:]')
if [ "$done_before" = "0" ]; then pizza=yes; else pizza=no; fi

mkdir -p release-logs
log="release-logs/menu-preview-$(date +%Y%m%d-%H%M).txt"

bold "STEP 2 of 3: what the menu changes would do (preview, nothing changes)"
{
  if [ "$pizza" = "yes" ]; then
    echo "===== Pizza & burger menu (20 Nov) ====="
    psqlf -f - < scripts/one-off/menu-pizza-burger-2026-11-20.sql
  else
    echo "===== Pizza & burger menu (20 Nov): already applied earlier, skipped so your edits stay ====="
  fi
  echo
  echo "===== Locked menu (22 Nov) ====="
  psqlf -f - < scripts/one-off/menu-locked-2026-11-22.sql
} 2>&1 | tee "$log"
echo
echo "Saved to $log"

bold "STEP 3 of 3: apply the menu changes?"
printf 'Type YES to add the new menu (anything else stops here): '
read -r answer
if [ "$answer" != "YES" ]; then
  echo "Stopped. The site is updated; the menu is exactly as it was."
  exit 0
fi
printf 'Also take the old dishes off the menu (section 4 of the preview)? Type YES or NO: '
read -r retire

if [ "$pizza" = "yes" ]; then
  psqlf -v apply=1 -f - < scripts/one-off/menu-pizza-burger-2026-11-20.sql > /dev/null
fi
if [ "$retire" = "YES" ]; then
  psqlf -v apply=1 -v retire=1 -f - < scripts/one-off/menu-locked-2026-11-22.sql | tail -6
else
  psqlf -v apply=1 -f - < scripts/one-off/menu-locked-2026-11-22.sql | tail -6
fi

bold "Done."
echo "Next: Admin -> Menu -> 'Off the menu': type a price on each new dish, tap 'Price & put on menu'."
echo "If anything looks wrong, the backup taken in step 1 is in ./backups/."

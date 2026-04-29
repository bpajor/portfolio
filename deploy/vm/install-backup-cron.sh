#!/usr/bin/env bash
set -euo pipefail

app_dir="${APP_DIR:-/opt/portfolio-production}"
schedule="${BACKUP_CRON_SCHEDULE:-15 3 * * *}"
deploy_user="${DEPLOY_USER:-portfolio}"
cron_file="${CRON_FILE:-/etc/cron.d/portfolio-postgres-backup}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root, for example with sudo." >&2
  exit 1
fi

compose_dir="$app_dir/deploy/compose"
if [[ ! -x "$compose_dir/backup-to-gcs.sh" ]]; then
  echo "Missing executable $compose_dir/backup-to-gcs.sh" >&2
  exit 1
fi

cat > "$cron_file" <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

$schedule $deploy_user cd $compose_dir && ./backup-to-gcs.sh >> /var/log/portfolio-postgres-backup.log 2>&1
EOF

chmod 0644 "$cron_file"
echo "Installed $cron_file"

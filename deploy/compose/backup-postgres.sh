#!/usr/bin/env sh
set -eu

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
filename="portfolio-postgres-${timestamp}.dump"
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ -f "${script_dir}/.env" ]; then
  set -a
  . "${script_dir}/.env"
  set +a
fi

backup_dir="${BACKUP_DIR:-./backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
compose_project="${COMPOSE_PROJECT_NAME:-portfolio}"

mkdir -p "$backup_dir"

docker compose -p "$compose_project" -f "${script_dir}/compose.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:?POSTGRES_USER is required}" \
  -d "${POSTGRES_DB:?POSTGRES_DB is required}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  > "${backup_dir}/${filename}"

find "$backup_dir" -type f -name 'portfolio-postgres-*.dump' -mtime "+${retention_days}" -delete

printf '%s\n' "${backup_dir}/${filename}"

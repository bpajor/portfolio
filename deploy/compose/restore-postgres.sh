#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [ -f "${script_dir}/.env" ]; then
  set -a
  . "${script_dir}/.env"
  set +a
fi

dump_path="${RESTORE_DUMP:-${1:-}}"
confirm="${CONFIRM_RESTORE:-}"
compose_project="${COMPOSE_PROJECT_NAME:-portfolio}"

if [ -z "$dump_path" ]; then
  echo "Usage: CONFIRM_RESTORE=I_UNDERSTAND_THIS_OVERWRITES_DATABASE RESTORE_DUMP=./backups/file.dump ./restore-postgres.sh" >&2
  exit 1
fi

if [ "$confirm" != "I_UNDERSTAND_THIS_OVERWRITES_DATABASE" ]; then
  echo "Refusing to restore without explicit confirmation." >&2
  echo "Set CONFIRM_RESTORE=I_UNDERSTAND_THIS_OVERWRITES_DATABASE." >&2
  exit 1
fi

if [ ! -f "$dump_path" ]; then
  echo "Restore dump not found: $dump_path" >&2
  exit 1
fi

if [ "${SKIP_PRE_RESTORE_BACKUP:-false}" != "true" ]; then
  echo "Creating pre-restore backup..."
  "${script_dir}/backup-postgres.sh" >/dev/null
fi

echo "Restoring $dump_path into ${POSTGRES_DB:?POSTGRES_DB is required}..."
docker compose -p "$compose_project" -f "${script_dir}/compose.yml" exec -T postgres \
  pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    -U "${POSTGRES_USER:?POSTGRES_USER is required}" \
    -d "${POSTGRES_DB:?POSTGRES_DB is required}" \
  < "$dump_path"

echo "Restore completed."

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="${POSTGRES_TEST_CONTAINER:-portfolio-postgres-migration-test}"
user="${POSTGRES_USER:-portfolio}"
password="${POSTGRES_PASSWORD:-portfolio}"
database="${POSTGRES_DB:-portfolio}"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cleanup

docker run -d \
  --name "$container" \
  -e "POSTGRES_USER=$user" \
  -e "POSTGRES_PASSWORD=$password" \
  -e "POSTGRES_DB=$database" \
  postgres:13 >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U "$user" -d "$database" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$container" pg_isready -U "$user" -d "$database" >/dev/null

sed '/-- +goose Down/,$d' "$repo_root/db/migrations/00001_initial_schema.sql" |
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$user" -d "$database" >/dev/null

schema_check="$(docker exec "$container" psql -tAc "SELECT to_regclass('public.profile')" -U "$user" -d "$database" | tr -d '[:space:]')"
if [[ "$schema_check" != "profile" ]]; then
  echo "Up migration did not create public.profile" >&2
  exit 1
fi

sed '1,/-- +goose Down/d' "$repo_root/db/migrations/00001_initial_schema.sql" |
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$user" -d "$database" >/dev/null

schema_check="$(docker exec "$container" psql -tAc "SELECT to_regclass('public.profile')" -U "$user" -d "$database" | tr -d '[:space:]')"
if [[ -n "$schema_check" ]]; then
  echo "Down migration left public.profile in place" >&2
  exit 1
fi

echo "Migration Up/Down validation passed."

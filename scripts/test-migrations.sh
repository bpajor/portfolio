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

ready=0
for _ in $(seq 1 60); do
  if docker exec "$container" psql -v ON_ERROR_STOP=1 -U "$user" -d "$database" -tAc "SELECT 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [[ "$ready" -ne 1 ]]; then
  echo "PostgreSQL database '$database' did not become ready." >&2
  docker logs "$container" >&2 || true
  exit 1
fi

sed '/-- +goose Down/,$d' "$repo_root/db/migrations/00001_initial_schema.sql" |
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$user" -d "$database" >/dev/null
docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$user" -d "$database" \
  -f /dev/stdin < "$repo_root/db/migrations/00002_seed_initial_posts.sql" >/dev/null
docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$user" -d "$database" \
  -f /dev/stdin < "$repo_root/db/migrations/00002_seed_initial_posts.sql" >/dev/null

schema_check="$(docker exec "$container" psql -tAc "SELECT to_regclass('public.profile')" -U "$user" -d "$database" | tr -d '[:space:]')"
if [[ "$schema_check" != "profile" ]]; then
  echo "Up migration did not create public.profile" >&2
  exit 1
fi
post_count="$(docker exec "$container" psql -tAc "SELECT count(*) FROM posts" -U "$user" -d "$database" | tr -d '[:space:]')"
if [[ "$post_count" != "2" ]]; then
  echo "Seed migration post count = $post_count, want 2" >&2
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

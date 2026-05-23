#!/usr/bin/env sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
env_file="${ENV_FILE:-${script_dir}/.env}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

value_of() {
  key="$1"
  awk -F= -v key="$key" '
    $0 ~ "^[[:space:]]*#" { next }
    $1 == key {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      gsub(/^"|"$/, "")
      gsub(/^'\''|'\''$/, "")
      print
    }
  ' "$env_file" | tail -n 1
}

require_value() {
  key="$1"
  value="$(value_of "$key")"
  [ -n "$value" ] || fail "$key is required in $env_file"
  printf '%s' "$value"
}

[ -f "$env_file" ] || fail "env file not found: $env_file"

new_password="${NEW_ADMIN_PASSWORD:-}"
[ -n "$new_password" ] || fail "NEW_ADMIN_PASSWORD is required"

case "$new_password" in
  *[[:lower:]]*) ;;
  *) fail "NEW_ADMIN_PASSWORD must contain a lowercase letter" ;;
esac
case "$new_password" in
  *[[:upper:]]*) ;;
  *) fail "NEW_ADMIN_PASSWORD must contain an uppercase letter" ;;
esac
case "$new_password" in
  *[[:digit:]]*) ;;
  *) fail "NEW_ADMIN_PASSWORD must contain a digit" ;;
esac
case "$new_password" in
  *[![:alnum:]]*) ;;
  *) fail "NEW_ADMIN_PASSWORD must contain a symbol" ;;
esac
[ "${#new_password}" -ge 12 ] || fail "NEW_ADMIN_PASSWORD must be at least 12 characters"

compose_project="$(value_of COMPOSE_PROJECT_NAME)"
[ -n "$compose_project" ] || compose_project="portfolio"
postgres_user="$(require_value POSTGRES_USER)"
postgres_db="$(require_value POSTGRES_DB)"
admin_email="${ADMIN_EMAIL:-$(require_value ADMIN_EMAIL)}"

if [ "${SKIP_BACKUP:-false}" != "true" ]; then
  echo "Creating a pre-reset backup..."
  "${script_dir}/backup-postgres.sh" >/dev/null
fi

docker compose -p "$compose_project" --env-file "$env_file" -f "${script_dir}/compose.yml" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$postgres_user" -d "$postgres_db" \
  -v admin_email="$admin_email" \
  -v new_password="$new_password" <<'SQL'
WITH changed AS (
  UPDATE users
  SET password_hash = crypt(:'new_password', gen_salt('bf', 10)),
      updated_at = now()
  WHERE email = :'admin_email'
  RETURNING id
)
SELECT count(*) AS changed_count FROM changed;
\gset
\if :changed_count
\else
  \echo admin user not found
  \quit 1
\endif
UPDATE sessions
SET revoked_at = now()
WHERE user_id IN (SELECT id FROM users WHERE email = :'admin_email')
  AND revoked_at IS NULL;
SQL

echo "Admin password reset for ${admin_email}. Existing admin sessions were revoked."

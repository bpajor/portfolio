#!/usr/bin/env sh
set -eu

mode="${1:-}"
env_file="${2:-.env}"
errors=0

fail() {
  echo "ERROR: $*" >&2
  errors=$((errors + 1))
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
  if [ -z "$value" ]; then
    fail "$key is required"
    return
  fi
  case "$value" in
    *replace-with*|*change-me*|*example.com*)
      fail "$key still contains a placeholder value"
      ;;
  esac
}

require_secret_length() {
  key="$1"
  min="$2"
  value="$(value_of "$key")"
  if [ -n "$value" ] && [ "${#value}" -lt "$min" ]; then
    fail "$key must be at least $min characters"
  fi
}

require_admin_password_strength() {
  value="$(value_of ADMIN_PASSWORD)"
  if [ -z "$value" ]; then
    return
  fi
  if [ "${#value}" -lt 12 ]; then
    fail "ADMIN_PASSWORD must be at least 12 characters"
  fi
  case "$value" in
    *[[:lower:]]*) ;;
    *) fail "ADMIN_PASSWORD must contain a lowercase letter" ;;
  esac
  case "$value" in
    *[[:upper:]]*) ;;
    *) fail "ADMIN_PASSWORD must contain an uppercase letter" ;;
  esac
  case "$value" in
    *[[:digit:]]*) ;;
    *) fail "ADMIN_PASSWORD must contain a digit" ;;
  esac
  case "$value" in
    *[![:alnum:]]*) ;;
    *) fail "ADMIN_PASSWORD must contain a symbol" ;;
  esac
}

require_url_prefix() {
  key="$1"
  prefix="$2"
  value="$(value_of "$key")"
  case "$value" in
    "$prefix"*) ;;
    *) fail "$key must start with $prefix" ;;
  esac
}

case "$mode" in
  staging|production) ;;
  *) fail "usage: $0 staging|production [env-file]" ;;
esac

if [ ! -f "$env_file" ]; then
  fail "env file not found: $env_file"
fi

for key in \
  COMPOSE_PROJECT_NAME \
  SITE_ADDRESS \
  HTTP_PORT \
  HTTPS_PORT \
  NEXT_PUBLIC_SITE_URL \
  NEXT_PUBLIC_API_BASE_URL \
  API_ALLOWED_ORIGINS \
  POSTGRES_USER \
  POSTGRES_PASSWORD \
  POSTGRES_DB \
  ADMIN_EMAIL \
  ADMIN_PASSWORD \
  SESSION_SECRET \
  TURNSTILE_SECRET_KEY \
  MCP_BEARER_TOKEN \
  MCP_ADMIN_BEARER_TOKEN \
  MCP_ALLOWED_ORIGINS \
  BACKUP_BUCKET
do
  require_value "$key"
done

for key in POSTGRES_PASSWORD SESSION_SECRET TURNSTILE_SECRET_KEY MCP_BEARER_TOKEN MCP_ADMIN_BEARER_TOKEN; do
  require_secret_length "$key" 24
done
require_admin_password_strength

if [ "$(value_of MCP_BEARER_TOKEN)" = "$(value_of MCP_ADMIN_BEARER_TOKEN)" ]; then
  fail "MCP_BEARER_TOKEN and MCP_ADMIN_BEARER_TOKEN must be different"
fi

case "$(value_of BACKUP_BUCKET)" in
  gs://*) ;;
  *) fail "BACKUP_BUCKET must start with gs://" ;;
esac

case "$mode" in
  staging)
    [ "$(value_of COMPOSE_PROJECT_NAME)" = "portfolio-staging" ] || fail "staging COMPOSE_PROJECT_NAME must be portfolio-staging"
    [ "$(value_of SITE_ADDRESS)" = ":80" ] || fail "staging SITE_ADDRESS must be :80"
    case "$(value_of HTTP_PORT)" in
      127.0.0.1:*) ;;
      *) fail "staging HTTP_PORT must bind to 127.0.0.1" ;;
    esac
    case "$(value_of HTTPS_PORT)" in
      127.0.0.1:*) ;;
      *) fail "staging HTTPS_PORT must bind to 127.0.0.1" ;;
    esac
    require_url_prefix NEXT_PUBLIC_SITE_URL "http://127.0.0.1:"
    ;;
  production)
    [ "$(value_of COMPOSE_PROJECT_NAME)" = "portfolio-production" ] || fail "production COMPOSE_PROJECT_NAME must be portfolio-production"
    [ "$(value_of HTTP_PORT)" = "80" ] || fail "production HTTP_PORT must be 80"
    [ "$(value_of HTTPS_PORT)" = "443" ] || fail "production HTTPS_PORT must be 443"
    require_url_prefix NEXT_PUBLIC_SITE_URL "https://"
    require_url_prefix API_ALLOWED_ORIGINS "$(value_of NEXT_PUBLIC_SITE_URL)"
    require_url_prefix MCP_ALLOWED_ORIGINS "$(value_of NEXT_PUBLIC_SITE_URL)"
    ;;
esac

if [ "$errors" -ne 0 ]; then
  echo "Environment validation failed with $errors error(s)." >&2
  exit 1
fi

echo "Environment validation passed for $mode."

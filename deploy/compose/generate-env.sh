#!/usr/bin/env sh
set -eu

mode="${1:-}"

usage() {
  cat >&2 <<'EOF'
Usage:
  DOMAIN=bpajor.dev ADMIN_EMAIL=admin@example.com TURNSTILE_SECRET_KEY=... BACKUP_BUCKET=gs://bucket ./generate-env.sh staging > .env
  DOMAIN=bpajor.dev ADMIN_EMAIL=admin@example.com TURNSTILE_SECRET_KEY=... BACKUP_BUCKET=gs://bucket ./generate-env.sh production > .env
EOF
  exit 1
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32 | tr -d '\n'
  else
    dd if=/dev/urandom bs=32 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n'
  fi
}

case "$mode" in
  staging|production) ;;
  *) usage ;;
esac

domain="${DOMAIN:?DOMAIN is required}"
admin_email="${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
turnstile_secret="${TURNSTILE_SECRET_KEY:?TURNSTILE_SECRET_KEY is required}"
backup_bucket="${BACKUP_BUCKET:?BACKUP_BUCKET is required}"

case "$backup_bucket" in
  gs://*) ;;
  *) backup_bucket="gs://${backup_bucket}" ;;
esac

postgres_password="$(random_secret)"
admin_password="$(random_secret)"
session_secret="$(random_secret)"
mcp_read_token="$(random_secret)"
mcp_admin_token="$(random_secret)"

if [ "$mode" = "staging" ]; then
  compose_project="portfolio-staging"
  site_address=":80"
  http_port="127.0.0.1:18080"
  https_port="127.0.0.1:18443"
  site_url="${STAGING_SITE_URL:-http://127.0.0.1:3000}"
  allowed_origins="$site_url"
else
  compose_project="portfolio-production"
  site_address="${domain},www.${domain}"
  http_port="80"
  https_port="443"
  site_url="https://${domain}"
  allowed_origins="${site_url},https://www.${domain}"
fi

cat <<EOF
COMPOSE_PROJECT_NAME=${compose_project}
SITE_ADDRESS=${site_address}
HTTP_PORT=${http_port}
HTTPS_PORT=${https_port}

NEXT_PUBLIC_SITE_URL=${site_url}
NEXT_PUBLIC_API_BASE_URL=/api

API_ALLOWED_ORIGINS=${allowed_origins}
API_COOKIE_SECURE=true

POSTGRES_USER=portfolio
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=portfolio

ADMIN_EMAIL=${admin_email}
ADMIN_PASSWORD=${admin_password}
SESSION_SECRET=${session_secret}
TURNSTILE_SECRET_KEY=${turnstile_secret}
TURNSTILE_VERIFY_URL=https://challenges.cloudflare.com/turnstile/v0/siteverify

MCP_BEARER_TOKEN=${mcp_read_token}
MCP_ADMIN_BEARER_TOKEN=${mcp_admin_token}
MCP_ALLOWED_ORIGINS=${allowed_origins}

BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=14
BACKUP_BUCKET=${backup_bucket}
EOF

#!/usr/bin/env sh
set -eu

mode="${1:-}"
env_file="${2:-.env}"

usage() {
  cat >&2 <<'EOF'
Usage:
  ./preflight.sh staging [.env]
  ./preflight.sh production [.env]

Optional:
  BASE_URL=https://bpajor.dev ./preflight.sh production .env
EOF
  exit 1
}

info() {
  echo "==> $*"
}

warn() {
  echo "WARN: $*" >&2
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
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

case "$mode" in
  staging|production) ;;
  *) usage ;;
esac

[ -f "$env_file" ] || fail "env file not found: $env_file"

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$script_dir"

info "Checking required commands"
require_command awk
require_command docker
require_command git

if ! docker compose version >/dev/null 2>&1; then
  fail "docker compose plugin is required"
fi

info "Checking repository state"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "not inside a git checkout"
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  warn "current branch is $current_branch, expected main for deployment"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "working tree has local changes; deploy workflow expects a clean main checkout"
fi

info "Validating $mode environment"
./validate-env.sh "$mode" "$env_file"

info "Validating Docker Compose configuration"
docker compose --env-file "$env_file" -f compose.yml config >/dev/null

compose_project="$(value_of COMPOSE_PROJECT_NAME)"
site_url="$(value_of NEXT_PUBLIC_SITE_URL)"
api_url="$(value_of NEXT_PUBLIC_API_BASE_URL)"
backup_bucket="$(value_of BACKUP_BUCKET)"

info "Deployment summary"
echo "Mode:                  $mode"
echo "Compose project:       $compose_project"
echo "Next public site URL:  $site_url"
echo "Next public API URL:   $api_url"
echo "Backup bucket:         $backup_bucket"

if command -v ssh >/dev/null 2>&1 && [ -n "${SSH_HOST:-}" ] && [ -n "${SSH_PORT:-}" ] && [ -n "${SSH_USER:-}" ]; then
  info "Checking local SSH auth sanity to $SSH_USER@$SSH_HOST:$SSH_PORT"
  if ! ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" true >/dev/null 2>&1; then
    warn "local SSH sanity check failed; GitHub deploys still require runner firewall access, deploy key auth, and host fingerprint secrets"
  fi
else
  warn "SSH_HOST, SSH_PORT, SSH_USER, or ssh client is missing; skipping local SSH sanity check"
fi

case "$mode" in
  staging)
    echo "GitHub APP_DIR secret: /opt/portfolio-staging"
    echo "GitHub BASE_URL var:   http://127.0.0.1:3000"
    echo "Tunnel target port:    18080"
    ;;
  production)
    echo "GitHub APP_DIR secret: /opt/portfolio-production"
    echo "GitHub BASE_URL var:   $site_url"
    ;;
esac

if [ -n "${BASE_URL:-}" ]; then
  info "Running smoke checks against $BASE_URL"
  require_command curl
  BASE_URL="$BASE_URL" ./smoke-check.sh
else
  warn "BASE_URL is not set; skipping smoke checks"
fi

cat <<EOF

Preflight passed for $mode.

Before enabling automatic deploys, confirm in GitHub:
- environments exist: staging, production
- production environment has required reviewers
- environment secrets exist: SSH_HOST, SSH_USER, SSH_PRIVATE_KEY, SSH_PORT, SSH_KNOWN_HOSTS, SSH_FINGERPRINT, APP_DIR
- environment vars exist: BASE_URL
- staging vars exist: STAGING_TUNNEL_LOCAL_PORT, STAGING_TUNNEL_TARGET_HOST, STAGING_TUNNEL_TARGET_PORT
- repository var DEPLOY_ENABLED is set to true only after the first successful manual deployment
EOF

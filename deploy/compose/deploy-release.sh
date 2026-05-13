#!/usr/bin/env bash
set -euo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${RELEASE_IMAGE_ARCHIVE:?RELEASE_IMAGE_ARCHIVE is required}"
: "${DEPLOY_MODE:?DEPLOY_MODE is required}"
: "${RUN_BACKUP:?RUN_BACKUP is required}"
: "${EXPECTED_IMAGE_REVISION:?EXPECTED_IMAGE_REVISION is required}"
: "${RELEASE_SERVICES:=web api mcp}"

cleanup() {
  if [ "${PORTFOLIO_DEPLOY_AS_USER:-}" != "1" ]; then
    rm -f "$RELEASE_IMAGE_ARCHIVE" || true
  fi
  case "$0" in
    /tmp/*) rm -f "$0" || true ;;
  esac
}
trap cleanup EXIT

log() {
  printf '==> %s\n' "$*"
}

if [ "${PORTFOLIO_DEPLOY_AS_USER:-}" != "1" ]; then
  chmod 0644 "$RELEASE_IMAGE_ARCHIVE"
  exec sudo -u portfolio env \
    APP_DIR="$APP_DIR" \
    RELEASE_IMAGE_ARCHIVE="$RELEASE_IMAGE_ARCHIVE" \
    DEPLOY_MODE="$DEPLOY_MODE" \
    RUN_BACKUP="$RUN_BACKUP" \
    EXPECTED_IMAGE_REVISION="$EXPECTED_IMAGE_REVISION" \
    RELEASE_SERVICES="$RELEASE_SERVICES" \
    PORTFOLIO_DEPLOY_AS_USER=1 \
    bash "$0"
fi

release_services=""
for service in $RELEASE_SERVICES; do
  case "$service" in
    web|api|mcp)
      case " $release_services " in
        *" $service "*) ;;
        *) release_services="${release_services:+$release_services }$service" ;;
      esac
      ;;
    *)
      echo "ERROR: unsupported release service '$service'; expected web, api, or mcp" >&2
      exit 1
      ;;
  esac
done

if [ -z "$release_services" ]; then
  echo "ERROR: RELEASE_SERVICES must include at least one service" >&2
  exit 1
fi

image_revision() {
  docker image inspect "$1" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
}

container_revision() {
  docker inspect "$1" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
}

require_revision() {
  kind="$1"
  name="$2"
  actual_revision="$3"

  log "$kind $name revision=$actual_revision expected=$EXPECTED_IMAGE_REVISION"
  if [ "$actual_revision" != "$EXPECTED_IMAGE_REVISION" ]; then
    echo "ERROR: $kind $name revision $actual_revision does not match expected $EXPECTED_IMAGE_REVISION" >&2
    exit 1
  fi
}

cd "$APP_DIR"
log "Updating repository checkout"
git fetch origin main
git checkout main
git pull --ff-only origin main

cd deploy/compose

if [ "$DEPLOY_MODE" = "staging" ]; then
  log "Ensuring Cloud Shell preview origins are allowed for staging"
  for key in API_ALLOWED_ORIGINS MCP_ALLOWED_ORIGINS; do
    current="$(grep -E "^${key}=" .env | tail -n 1 | cut -d= -f2-)"
    case ",$current," in
      *",https://*.cloudshell.dev,"*) ;;
      *)
        if [ -n "$current" ]; then
          next="${current},https://*.cloudshell.dev"
        else
          next="https://*.cloudshell.dev"
        fi
        if grep -qE "^${key}=" .env; then
          sed -i "s|^${key}=.*|${key}=${next}|" .env
        else
          printf '%s=%s\n' "$key" "$next" >> .env
        fi
        ;;
    esac
  done

  log "Ensuring staging Turnstile test keys are configured"
  for entry in \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
    TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
  do
    key="${entry%%=*}"
    value="${entry#*=}"
    if grep -qE "^${key}=" .env; then
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
      printf '%s=%s\n' "$key" "$value" >> .env
    fi
  done
fi

log "Validating $DEPLOY_MODE environment"
./validate-env.sh "$DEPLOY_MODE" .env

if [ "$RUN_BACKUP" = "true" ]; then
  log "Creating best-effort database backup"
  ./backup-postgres.sh || true
fi

compose_project="$(awk -F= '$1 == "COMPOSE_PROJECT_NAME" {print $2}' .env | tail -n 1)"
if [ -z "$compose_project" ]; then
  echo "ERROR: COMPOSE_PROJECT_NAME is required in .env" >&2
  exit 1
fi

log "Release archive"
ls -lh "$RELEASE_IMAGE_ARCHIVE"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$RELEASE_IMAGE_ARCHIVE"
fi

log "Images before docker load"
for service in $release_services; do
  image="${compose_project}-${service}:latest"
  if docker image inspect "$image" >/dev/null 2>&1; then
    docker image inspect "$image" --format "$image {{.ID}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
  else
    echo "$image is not present"
  fi
done

log "Loading release images"
docker load -i "$RELEASE_IMAGE_ARCHIVE"

log "Images after docker load"
for service in $release_services; do
  image="${compose_project}-${service}:latest"
  docker image inspect "$image" --format "$image {{.ID}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
  require_revision image "$image" "$(image_revision "$image")"
done

log "Recreating application services"
docker compose --env-file .env -f compose.yml up -d --no-build --force-recreate $release_services

log "Verifying running container revisions"
for service in $release_services; do
  container="${compose_project}-${service}-1"
  docker inspect "$container" --format "$container {{.Image}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
  require_revision container "$container" "$(container_revision "$container")"
done

docker compose --env-file .env -f compose.yml ps

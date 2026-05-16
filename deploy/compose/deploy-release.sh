#!/usr/bin/env bash
set -euo pipefail

: "${APP_DIR:?APP_DIR is required}"
: "${RELEASE_IMAGE_ARCHIVE:=}"
: "${RELEASE_IMAGE_REFS:=}"
: "${DEPLOY_MODE:?DEPLOY_MODE is required}"
: "${RUN_BACKUP:?RUN_BACKUP is required}"
: "${EXPECTED_IMAGE_REVISION:?EXPECTED_IMAGE_REVISION is required}"
: "${RELEASE_SERVICES:=web api mcp}"

if [ -z "$RELEASE_IMAGE_ARCHIVE" ] && [ -z "$RELEASE_IMAGE_REFS" ]; then
  echo "ERROR: RELEASE_IMAGE_ARCHIVE or RELEASE_IMAGE_REFS is required" >&2
  exit 1
fi

cleanup() {
  if [ "${PORTFOLIO_DEPLOY_AS_USER:-}" != "1" ] && [ -n "$RELEASE_IMAGE_ARCHIVE" ]; then
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
  if [ -n "$RELEASE_IMAGE_ARCHIVE" ]; then
    chmod 0644 "$RELEASE_IMAGE_ARCHIVE"
  fi
  exec sudo -u portfolio env \
    APP_DIR="$APP_DIR" \
    RELEASE_IMAGE_ARCHIVE="$RELEASE_IMAGE_ARCHIVE" \
    RELEASE_IMAGE_REFS="$RELEASE_IMAGE_REFS" \
    DEPLOY_MODE="$DEPLOY_MODE" \
    RUN_BACKUP="$RUN_BACKUP" \
    EXPECTED_IMAGE_REVISION="$EXPECTED_IMAGE_REVISION" \
    RELEASE_SERVICES="$RELEASE_SERVICES" \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY="${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}" \
    TURNSTILE_SECRET_KEY="${TURNSTILE_SECRET_KEY:-}" \
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

restart_existing_services=""
release_transport="archive"
if [ -n "$RELEASE_IMAGE_REFS" ]; then
  release_transport="registry"
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

set_env_value() {
  key="$1"
  value="$2"
  tmp_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      replaced = 1
      next
    }
    { print }
    END {
      if (replaced == 0) {
        print key "=" value
      }
    }
  ' .env >"$tmp_file"
  cat "$tmp_file" >.env
  rm -f "$tmp_file"
}

image_ref_for_service() {
  service="$1"
  for entry in $RELEASE_IMAGE_REFS; do
    case "$entry" in
      "$service="*) printf '%s\n' "${entry#*=}"; return 0 ;;
    esac
  done
  return 1
}

artifact_registry_host() {
  for entry in $RELEASE_IMAGE_REFS; do
    ref="${entry#*=}"
    printf '%s\n' "${ref%%/*}"
    return 0
  done
  return 1
}

docker_login_artifact_registry() {
  host="$1"
  log "Authenticating Docker to $host with the VM service account"
  token="$(
    curl -fsS \
      -H "Metadata-Flavor: Google" \
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" |
      python3 -c 'import json, sys; print(json.load(sys.stdin)["access_token"])'
  )"
  printf '%s' "$token" | docker login -u oauth2accesstoken --password-stdin "https://$host" >/dev/null
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
        set_env_value "$key" "$next"
        ;;
    esac
  done

  log "Ensuring staging Turnstile test keys are configured"
  set_env_value "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "1x00000000000000000000AA"
  set_env_value "TURNSTILE_SECRET_KEY" "1x0000000000000000000000000000000AA"

  case " $release_services " in
    *" api "*) ;;
    *) restart_existing_services="${restart_existing_services:+$restart_existing_services }api" ;;
  esac
  case " $release_services " in
    *" mcp "*) ;;
    *) restart_existing_services="${restart_existing_services:+$restart_existing_services }mcp" ;;
  esac
fi

if [ "$DEPLOY_MODE" = "production" ] &&
  { [ -n "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}" ] || [ -n "${TURNSTILE_SECRET_KEY:-}" ]; }; then
  : "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:?NEXT_PUBLIC_TURNSTILE_SITE_KEY is required when syncing production Turnstile env}"
  : "${TURNSTILE_SECRET_KEY:?TURNSTILE_SECRET_KEY is required when syncing production Turnstile env}"

  log "Syncing production Turnstile environment"
  set_env_value "NEXT_PUBLIC_TURNSTILE_SITE_KEY" "$NEXT_PUBLIC_TURNSTILE_SITE_KEY"
  set_env_value "TURNSTILE_SECRET_KEY" "$TURNSTILE_SECRET_KEY"

  case " $release_services " in
    *" api "*) ;;
    *) restart_existing_services="${restart_existing_services:+$restart_existing_services }api" ;;
  esac
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

log "Images before release update"
for service in $release_services; do
  image="${compose_project}-${service}:latest"
  if docker image inspect "$image" >/dev/null 2>&1; then
    docker image inspect "$image" --format "$image {{.ID}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
  else
    echo "$image is not present"
  fi
done

case "$release_transport" in
  archive)
    log "Release archive"
    ls -lh "$RELEASE_IMAGE_ARCHIVE"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$RELEASE_IMAGE_ARCHIVE"
    fi

    log "Loading release images"
    docker load -i "$RELEASE_IMAGE_ARCHIVE"

    log "Images after docker load"
    for service in $release_services; do
      image="${compose_project}-${service}:latest"
      docker image inspect "$image" --format "$image {{.ID}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
      require_revision image "$image" "$(image_revision "$image")"
    done
    ;;
  registry)
    log "Release image refs"
    printf '%s\n' "$RELEASE_IMAGE_REFS"
    docker_login_artifact_registry "$(artifact_registry_host)"

    log "Pulling release images from Artifact Registry"
    for service in $release_services; do
      image_ref="$(image_ref_for_service "$service")"
      image="${compose_project}-${service}:latest"
      docker pull "$image_ref"
      docker image inspect "$image_ref" --format "$image_ref {{.ID}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
      require_revision image "$image_ref" "$(image_revision "$image_ref")"
      docker tag "$image_ref" "$image"
      docker image inspect "$image" --format "$image {{.ID}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
      require_revision image "$image" "$(image_revision "$image")"
    done
    ;;
  *)
    echo "ERROR: unsupported release transport '$release_transport'" >&2
    exit 1
    ;;
esac

log "Recreating application services"
docker compose --env-file .env -f compose.yml up -d --no-build --force-recreate $release_services

log "Verifying running container revisions"
for service in $release_services; do
  container="${compose_project}-${service}-1"
  docker inspect "$container" --format "$container {{.Image}} revision={{ index .Config.Labels \"org.opencontainers.image.revision\" }}"
  require_revision container "$container" "$(container_revision "$container")"
done

if [ -n "$restart_existing_services" ]; then
  log "Recreating existing services for environment-only changes"
  docker compose --env-file .env -f compose.yml up -d --no-build --force-recreate $restart_existing_services
fi

docker compose --env-file .env -f compose.yml ps

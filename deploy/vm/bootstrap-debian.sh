#!/usr/bin/env bash
set -euo pipefail

repo_url="${REPO_URL:-https://github.com/bpajor/portfolio.git}"
app_root="${APP_ROOT:-/opt}"
deploy_user="${DEPLOY_USER:-portfolio}"
deploy_group="${DEPLOY_GROUP:-$deploy_user}"
repo_branch="${REPO_BRANCH:-main}"
staging_dir="${STAGING_APP_DIR:-$app_root/portfolio-staging}"
production_dir="${PRODUCTION_APP_DIR:-$app_root/portfolio-production}"
deploy_public_key="${DEPLOY_PUBLIC_KEY:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this script as root, for example with sudo." >&2
  exit 1
fi

ensure_user() {
  if ! id "$deploy_user" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$deploy_user"
  fi
}

install_deploy_public_key() {
  if [[ -z "$deploy_public_key" ]]; then
    return
  fi

  local home_dir
  home_dir="$(getent passwd "$deploy_user" | cut -d: -f6)"
  if [[ -z "$home_dir" ]]; then
    echo "Could not resolve home directory for $deploy_user." >&2
    exit 1
  fi

  install -d -m 0700 -o "$deploy_user" -g "$deploy_group" "$home_dir/.ssh"
  touch "$home_dir/.ssh/authorized_keys"
  chmod 0600 "$home_dir/.ssh/authorized_keys"
  chown "$deploy_user:$deploy_group" "$home_dir/.ssh/authorized_keys"

  if ! grep -qxF "$deploy_public_key" "$home_dir/.ssh/authorized_keys"; then
    printf '%s\n' "$deploy_public_key" >> "$home_dir/.ssh/authorized_keys"
  fi
}

install_base_packages() {
  apt-get update
  apt-get install -y ca-certificates curl gnupg git openssh-client openssl lsb-release
}

install_gcloud_cli() {
  if command -v gcloud >/dev/null 2>&1; then
    return
  fi

  install -m 0755 -d /usr/share/keyrings
  curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg |
    gpg --dearmor --yes -o /usr/share/keyrings/cloud.google.gpg

  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
    > /etc/apt/sources.list.d/google-cloud-sdk.list

  apt-get update
  apt-get install -y google-cloud-cli
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg |
    gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

clone_or_update_repo() {
  local target_dir="$1"

  mkdir -p "$(dirname "$target_dir")"

  if [[ -d "$target_dir/.git" ]]; then
    git -C "$target_dir" fetch origin "$repo_branch"
    git -C "$target_dir" checkout "$repo_branch"
    git -C "$target_dir" pull --ff-only origin "$repo_branch"
  else
    git clone --branch "$repo_branch" "$repo_url" "$target_dir"
  fi

  chown -R "$deploy_user:$deploy_group" "$target_dir"
}

prepare_env_file() {
  local target_dir="$1"
  local env_file="$target_dir/deploy/compose/.env"

  if [[ ! -f "$env_file" ]]; then
    cp "$target_dir/deploy/compose/.env.example" "$env_file"
    chmod 600 "$env_file"
    chown "$deploy_user:$deploy_group" "$env_file"
    echo "Created $env_file. Edit it before the first deploy."
  fi
}

ensure_user
install_deploy_public_key
install_base_packages
install_gcloud_cli
install_docker

usermod -aG docker "$deploy_user"

clone_or_update_repo "$staging_dir"
clone_or_update_repo "$production_dir"
prepare_env_file "$staging_dir"
prepare_env_file "$production_dir"

cat <<EOF
Bootstrap complete.

Staging app dir:    $staging_dir
Production app dir: $production_dir

Next steps:
1. Edit both deploy/compose/.env files.
2. Add GitHub environment secrets APP_DIR, GCP_WORKLOAD_IDENTITY_PROVIDER, GCP_DEPLOY_SERVICE_ACCOUNT.
3. Add GitHub environment vars BASE_URL, GCP_PROJECT_ID, GCP_VM_NAME, GCP_VM_ZONE.
4. Log out and back in if you need the deploy user to pick up docker group membership.
EOF

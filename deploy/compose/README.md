# Compose Deployment

This directory contains the low-cost single-VM deployment stack.

Services:

- `caddy`: public reverse proxy and TLS endpoint.
- `web`: Next.js standalone server.
- `api`: Go REST API.
- `mcp`: Go MCP server.
- `postgres`: private PostgreSQL database with no public port.
- `migrate`: one-shot initial schema bootstrap for an empty database.

Local development PostgreSQL is available at the repository root in `compose.dev.yml`.
See `docs/local-development.md` for the current development workflow.
For GCP provisioning, DNS, and production launch steps, see `docs/gcp-dns-deployment.md`.
For GitHub Actions deployment, staging approval, secrets, and rollback, see `docs/cicd.md`.

## First Run

```bash
cd deploy/compose
cp .env.example .env
```

Edit `.env` and replace all secrets. For a real domain, set:

```bash
SITE_ADDRESS="bpajor.dev, www.bpajor.dev"
NEXT_PUBLIC_SITE_URL=https://bpajor.dev
NEXT_PUBLIC_API_BASE_URL=/api
NEXT_PUBLIC_TURNSTILE_SITE_KEY=replace-with-turnstile-site-key
API_ALLOWED_ORIGINS=https://bpajor.dev,https://www.bpajor.dev
MCP_ALLOWED_ORIGINS=https://bpajor.dev,https://www.bpajor.dev
```

You can generate a first-pass environment file with strong random secrets:

```bash
DOMAIN=bpajor.dev \
ADMIN_EMAIL=blazej122@vp.pl \
TURNSTILE_SITE_KEY=replace-with-turnstile-site-key \
TURNSTILE_SECRET_KEY=replace-with-turnstile-secret \
BACKUP_BUCKET=gs://your-backup-bucket \
./generate-env.sh production > .env
```

Start the stack:

```bash
./validate-env.sh production .env
./preflight.sh production .env
docker compose -f compose.yml up -d --build
```

GitHub Actions deployments build the `web`, `api`, and `mcp` images outside the VM and load them on the VM before starting Compose with `--no-build`. Image names are derived from `COMPOSE_PROJECT_NAME`, for example `portfolio-production-web:latest`, `portfolio-production-api:latest`, and `portfolio-production-mcp:latest`.

For a local smoke test without binding host port 80, set:

```bash
HTTP_PORT=18080
SITE_ADDRESS=:80
```

For private staging on the same VM as production, use a separate Compose project and bind the staging Caddy ports to localhost only:

```bash
COMPOSE_PROJECT_NAME=portfolio-staging
SITE_ADDRESS=:80
HTTP_PORT=127.0.0.1:18080
HTTPS_PORT=127.0.0.1:18443
```

Production should use a different Compose project name, for example `portfolio-production`, so database volumes and containers remain isolated.

Check health:

```bash
docker compose -f compose.yml ps
curl -fsS http://127.0.0.1/api/healthz
BASE_URL=http://127.0.0.1 ./smoke-check.sh
```

Before the first GitHub Actions deployment, run the preflight script on the VM:

```bash
cd /opt/portfolio-staging/deploy/compose
./preflight.sh staging .env

cd /opt/portfolio-production/deploy/compose
BASE_URL=https://bpajor.dev ./preflight.sh production .env
```

The preflight validates the `.env`, Docker Compose configuration, local git checkout, and optional smoke checks when `BASE_URL` is set. It also prints the GitHub environment variables and secrets that must exist before `DEPLOY_ENABLED=true` is enabled.

## Backups

Create a custom-format PostgreSQL dump:

```bash
./backup-postgres.sh
```

Backups are written to `BACKUP_DIR` and old dumps are removed after `BACKUP_RETENTION_DAYS`.

Upload the newest generated dump to the configured Cloud Storage bucket:

```bash
BACKUP_BUCKET=gs://your-backup-bucket ./backup-to-gcs.sh
```

For a scheduled production backup on a VM, run:

```bash
sudo APP_DIR=/opt/portfolio-production DEPLOY_USER=portfolio /opt/portfolio-production/deploy/vm/install-backup-cron.sh
```

Restore a custom-format dump only after you have a tested rollback reason:

```bash
CONFIRM_RESTORE=I_UNDERSTAND_THIS_OVERWRITES_DATABASE \
RESTORE_DUMP=./backups/portfolio-postgres-20260101T030000Z.dump \
./restore-postgres.sh
```

The restore helper creates a pre-restore backup unless `SKIP_PRE_RESTORE_BACKUP=true` is set.

## Security Notes

- PostgreSQL is attached only to the internal Compose network and has no host port.
- Caddy is the only public service and exposes ports `80` and `443`.
- MCP requires bearer authentication and validates allowed origins.
- Admin API is protected by the application session cookie.

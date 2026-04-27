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

## First Run

```bash
cd deploy/compose
cp .env.example .env
```

Edit `.env` and replace all secrets. For a real domain, set:

```bash
SITE_ADDRESS=bpajor.dev
NEXT_PUBLIC_SITE_URL=https://bpajor.dev
NEXT_PUBLIC_API_BASE_URL=/api
API_ALLOWED_ORIGINS=https://bpajor.dev
MCP_ALLOWED_ORIGINS=https://bpajor.dev
```

Start the stack:

```bash
docker compose -f compose.yml up -d --build
```

For a local smoke test without binding host port 80, set:

```bash
HTTP_PORT=18080
SITE_ADDRESS=:80
```

Check health:

```bash
docker compose -f compose.yml ps
curl -fsS http://127.0.0.1/api/healthz
```

## Backups

Create a custom-format PostgreSQL dump:

```bash
./backup-postgres.sh
```

Backups are written to `BACKUP_DIR` and old dumps are removed after `BACKUP_RETENTION_DAYS`.

## Security Notes

- PostgreSQL is attached only to the internal Compose network and has no host port.
- Caddy is the only public service and exposes ports `80` and `443`.
- MCP requires bearer authentication and validates allowed origins.
- Admin API is protected by the application session cookie.

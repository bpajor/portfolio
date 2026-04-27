# CI/CD

The repository uses GitHub Actions for pull request verification and gated production delivery.

## Pull Requests

`.github/workflows/pr-ci.yml` runs on every pull request to `main` and can also be called by other workflows.

Checks:

- install dependencies with `npm ci`
- web typecheck, lint, unit tests, build, and Playwright smoke E2E tests
- Go API tests
- Go MCP tests
- `sqlc generate` drift check for generated database code
- migration Up/Down validation against PostgreSQL
- API and MCP integration tests against a Docker Compose PostgreSQL service

The `main` branch protection should require this workflow before merge.

## Environments

Create two GitHub environments:

- `staging`
- `production`

Set required reviewers on `production`. Leave `staging` without manual approval so every merge to `main` deploys there first.

Each environment needs this variable:

- `BASE_URL`: public URL for that environment, for example `https://staging.bpajor.dev` or `https://bpajor.dev`

Each environment needs these secrets:

- `SSH_HOST`: VM public IP or DNS name
- `SSH_USER`: deploy user on the VM
- `SSH_PRIVATE_KEY`: private key for the deploy user
- `SSH_PORT`: usually `22`
- `APP_DIR`: absolute path to the checked-out repository on the VM

Use separate secrets for staging and production. Production secrets should only exist in the `production` environment.

## Main Deployment Flow

`.github/workflows/deploy.yml` runs on pushes to `main` and manually through `workflow_dispatch`.

Flow:

1. Reuse the full PR CI workflow.
2. Deploy `main` to `staging` over SSH.
3. Run smoke checks against staging:
   - `/api/healthz` must return success.
   - `/mcp` must reject anonymous access with `401`.
4. Run Playwright E2E checks against the deployed staging URL.
5. Wait for `production` environment approval.
6. Create a best-effort PostgreSQL backup on production.
7. Deploy `main` to production over SSH.
8. Run the same production smoke checks.

## VM Requirements

The deploy user must be able to run:

```bash
git fetch origin main
git pull --ff-only origin main
docker compose --env-file .env -f deploy/compose/compose.yml up -d --build
```

The VM should already have Docker, Docker Compose, repository checkout, and `deploy/compose/.env` configured. See `deploy/compose/README.md` and `docs/gcp-dns-deployment.md`.

## GCP Access Model

The current low-cost deployment model does not require a GitHub-hosted GCP service account key. GitHub Actions connects to the GCE VM over SSH, and the VM runs Docker Compose locally.

Recommended GCP setup:

- Create a dedicated OS Login or VM SSH deploy user with access only to the portfolio VM.
- Do not store broad GCP owner/editor keys in GitHub secrets.
- Keep VM firewall rules limited to SSH from trusted source ranges and public HTTP/HTTPS.
- If Terraform is later moved into CI, use Workload Identity Federation with a narrowly scoped service account instead of a JSON key.

Possible future Terraform CI service account roles:

- `roles/compute.admin` scoped to the deployment project only when VM lifecycle changes are automated.
- `roles/dns.admin` only if DNS zones are managed from CI.
- `roles/iam.serviceAccountUser` only for attaching service accounts to managed resources.

For now, Terraform should continue to be applied manually from a trusted local machine until the infrastructure workflow is explicitly added.

## Rollback

Preferred rollback:

1. Open the last known good commit in GitHub.
2. Re-run the deploy workflow from that commit or revert the bad PR and merge the revert to `main`.
3. Confirm staging smoke checks pass.
4. Approve production only after staging is healthy.

Emergency VM rollback:

```bash
cd "$APP_DIR"
git fetch origin main
git checkout <known-good-sha>
cd deploy/compose
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
```

If database state is corrupted, restore from the latest dump created by `deploy/compose/backup-postgres.sh`.

## Approval Checklist

Before approving production:

- PR CI passed on the merged change.
- Staging deployment completed successfully.
- Staging `/api/healthz` passed.
- Staging `/mcp` returned `401` without a bearer token.
- Staging Playwright E2E passed against the deployed URL.
- The change does not require manual database repair.
- A rollback commit or known good SHA is available.

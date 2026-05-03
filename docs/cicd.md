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

- `BASE_URL`: GitHub environment URL. For production, set the public URL, for example `https://bpajor.dev`.

Each environment needs these secrets:

- `SSH_HOST`: VM public IP or DNS name
- `SSH_USER`: deploy user on the VM
- `SSH_PRIVATE_KEY`: private key for the deploy user
- `SSH_PORT`: usually `22`
- `SSH_KNOWN_HOSTS`: expected SSH host key line for the VM
- `SSH_FINGERPRINT`: SHA256 host key fingerprint used by `appleboy/ssh-action`
- `APP_DIR`: absolute path to the checked-out repository on the VM

Use separate secrets for staging and production. Production secrets should only exist in the `production` environment.

For same-VM private staging, set these staging environment variables:

- `BASE_URL`: `http://127.0.0.1:3000`
- `STAGING_TUNNEL_LOCAL_PORT`: `3000`
- `STAGING_TUNNEL_TARGET_HOST`: `127.0.0.1`
- `STAGING_TUNNEL_TARGET_PORT`: `18080`

The staging VM `.env` should bind Caddy only to localhost:

```bash
COMPOSE_PROJECT_NAME=portfolio-staging
SITE_ADDRESS=:80
HTTP_PORT=127.0.0.1:18080
HTTPS_PORT=127.0.0.1:18443
```

The production VM `.env` can use the public ports and a different Compose project name:

```bash
COMPOSE_PROJECT_NAME=portfolio-production
SITE_ADDRESS=bpajor.dev, www.bpajor.dev
HTTP_PORT=80
HTTPS_PORT=443
```

With this model, staging is deployed on the same VM but is not publicly exposed. GitHub Actions opens an SSH tunnel to `127.0.0.1:18080` and runs smoke/E2E checks through that tunnel.

Both staging and production deploy jobs run `deploy/compose/validate-env.sh` before rebuilding the stack. The deploy stops early if required values are missing, placeholders remain, public Next.js URLs are inconsistent, MCP tokens match, or staging ports are not bound to localhost.

## Main Deployment Flow

`.github/workflows/deploy.yml` runs on pushes to `main` and manually through `workflow_dispatch`.

Push-to-main deployments are intentionally gated while the first infrastructure setup is in progress. Keep the repository variable `DEPLOY_ENABLED` unset or set to any value other than `true` until the VM, GitHub environments, SSH secrets, and environment `.env` files are ready.

When the deployment target is ready, set this repository variable:

- `DEPLOY_ENABLED`: `true`

Manual `workflow_dispatch` runs are allowed even when `DEPLOY_ENABLED` is not `true`, so the first staging and production launch can be started intentionally from GitHub Actions.

Before enabling automatic deploys, run the VM-side preflight checks:

```bash
cd /opt/portfolio-staging/deploy/compose
./preflight.sh staging .env

cd /opt/portfolio-production/deploy/compose
BASE_URL=https://bpajor.dev ./preflight.sh production .env
```

Generate the deploy SSH key locally, install only the public key on the VM through the bootstrap script, and store the private key in GitHub environment secrets:

```bash
ssh-keygen -t ed25519 -a 200 -f ~/.ssh/portfolio-github-actions -C "github-actions portfolio deploy"

sudo DEPLOY_PUBLIC_KEY="$(cat ~/.ssh/portfolio-github-actions.pub)" \
  bash deploy/vm/bootstrap-debian.sh
```

Get the host key values for GitHub secrets:

```bash
ssh-keyscan -p 22 YOUR_VM_IP_OR_DOMAIN
ssh-keyscan -p 22 YOUR_VM_IP_OR_DOMAIN 2>/dev/null | ssh-keygen -l -f - | awk '{print $2}' | head -n 1
```

Use the first command output for `SSH_KNOWN_HOSTS` and the second command output for `SSH_FINGERPRINT`.

Flow:

1. Reuse the full PR CI workflow.
2. Deploy `main` to `staging` over SSH.
3. Open an SSH tunnel from the GitHub runner to the private staging Caddy port.
4. Run smoke checks against staging:
   - `/api/healthz` must return success.
   - `/mcp` must reject anonymous access with `401`.
5. Run Playwright E2E checks against the deployed staging stack through the tunnel.
6. Wait for `production` environment approval.
7. Create a best-effort PostgreSQL backup on production.
8. Deploy `main` to production over SSH.
9. Run the same production smoke checks.

## VM Requirements

The deploy user must be able to run:

```bash
git fetch origin main
git pull --ff-only origin main
docker compose --env-file .env -f deploy/compose/compose.yml up -d --build
```

The VM should already have Docker, Docker Compose, repository checkout, and `deploy/compose/.env` configured. See `deploy/compose/README.md` and `docs/gcp-dns-deployment.md`.

First-release finding: the `up -d --build` VM deploy path is not reliable on the Free-Tier-sized `e2-micro` VM. During the initial manual release, image builds consumed enough CPU and memory to make SSH unreliable even with swap. Before enabling `DEPLOY_ENABLED=true`, move image builds to GitHub Actions or another external builder and make the VM deploy only pull or load prebuilt images, run migrations, start Compose, and execute smoke checks. TASK-024 tracks this change.

The GitHub-hosted deploy runner must also be able to reach the VM over SSH. In Terraform this means `ssh_source_ranges` must include the source CIDR used by the deploy runner. For a tighter setup, prefer a self-hosted runner with a stable egress IP or a future IAP-based deploy workflow. If direct SSH is closed, PR CI can still pass but staging and production deploy jobs will fail before any Compose command runs.

Do not run Terraform from GitHub Actions with an open `web_source_ranges = ["0.0.0.0/0"]` after the first public certificate is issued. The Terraform module default is Cloudflare IPv4-only origin access so an apply without production-specific tfvars does not reopen the VM origin. Use `0.0.0.0/0` only as an intentional, temporary override for first certificate issuance or direct origin debugging.

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
Use `deploy/compose/restore-postgres.sh` for this operation. It requires `CONFIRM_RESTORE=I_UNDERSTAND_THIS_OVERWRITES_DATABASE` and creates a pre-restore backup by default.

## Approval Checklist

Before approving production:

- PR CI passed on the merged change.
- Staging deployment completed successfully.
- Staging `/api/healthz` passed.
- Staging `/mcp` returned `401` without a bearer token.
- Staging Playwright E2E passed against the deployed URL.
- The change does not require manual database repair.
- A rollback commit or known good SHA is available.

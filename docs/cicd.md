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
- `GCP_PROJECT_ID`: GCP project that hosts the VM, for example `bpajor-portfolio-prod`.
- `GCP_VM_NAME`: Compute Engine VM name, for example `portfolio-vm`.
- `GCP_VM_ZONE`: Compute Engine VM zone, for example `us-central1-a`.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: Cloudflare Turnstile site key used by the public comment form. Staging defaults to Cloudflare's public test site key if unset; production must use the real site key for `bpajor.dev`.

Each environment needs these secrets:

- `APP_DIR`: absolute path to the checked-out repository on the VM
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Workload Identity Provider resource name.
- `GCP_DEPLOY_SERVICE_ACCOUNT`: deploy service account email used by GitHub Actions.

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
SITE_ADDRESS="bpajor.dev, www.bpajor.dev"
HTTP_PORT=80
HTTPS_PORT=443
```

With this model, staging is deployed on the same VM but is not publicly exposed. GitHub Actions opens an IAP-backed SSH tunnel to `127.0.0.1:18080` and runs smoke/E2E checks through that tunnel.

Both staging and production deploy jobs run `deploy/compose/validate-env.sh` before rebuilding the stack. The deploy stops early if required values are missing, placeholders remain, public Next.js URLs are inconsistent, MCP tokens match, or staging ports are not bound to localhost.

## Main Deployment Flow

`.github/workflows/deploy.yml` runs on pushes to `main` and manually through `workflow_dispatch`.

Push-to-main deployments are intentionally gated while the first infrastructure setup is in progress. Keep the repository variable `DEPLOY_ENABLED` unset or set to any value other than `true` until the VM, GitHub environments, IAP deploy service account, and environment `.env` files are ready.

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

GitHub Actions deploys through Google IAP TCP forwarding and OS Login. Do not create a long-lived deploy SSH key for GitHub. Enable `enable_github_iap_deploy = true` in Terraform, apply it from a trusted machine, store the resulting `github_deploy_service_account` output as the `GCP_DEPLOY_SERVICE_ACCOUNT` environment secret for both staging and production, and set the GitHub `terraform` environment variable `TF_VAR_ENABLE_GITHUB_IAP_DEPLOY=true` so future plan runs keep that resource.

Flow:

1. Reuse the full PR CI workflow.
2. Build staging Docker images on the GitHub runner.
3. Upload the staging image archive to the VM through IAP.
4. Deploy `main` to `staging` over IAP-backed SSH with `docker load` and `docker compose up --no-build`.
5. Open an IAP-backed SSH tunnel from the GitHub runner to the private staging Caddy port.
6. Run smoke checks against staging:
   - `/api/healthz` must return success.
   - `/mcp` must reject anonymous access with `401`.
7. Run Playwright E2E checks against the deployed staging stack through the tunnel.
8. Run Terraform plan with the shared GCS state and publish the plan in the deploy run summary and artifacts.
9. Wait for `production` environment approval after reviewing staging checks and the Terraform plan output from the same workflow run.
10. Build production Docker images on the GitHub runner and upload the image archive to the VM through IAP.
11. Create a best-effort PostgreSQL backup on production.
12. Deploy `main` to production over IAP-backed SSH with `docker load` and `docker compose up --no-build`.
13. Run production smoke checks through an IAP tunnel to the origin Caddy listener. This avoids false negatives from Cloudflare bot challenges against GitHub-hosted `curl` while still verifying the deployed production stack with the real production host and TLS certificate.

## VM Requirements

The deploy user must be able to run:

```bash
git fetch origin main
git pull --ff-only origin main
docker load -i /tmp/portfolio-release-images.tar.gz
docker compose --env-file .env -f deploy/compose/compose.yml up -d --no-build
```

The VM should already have Docker, Docker Compose, repository checkout, and `deploy/compose/.env` configured. See `deploy/compose/README.md` and `docs/gcp-dns-deployment.md`.

The deploy workflow treats the Free-Tier-sized `e2-micro` VM as a runtime target, not a build worker. GitHub Actions builds the web, API, and MCP Docker images on the runner, uploads a compressed image archive to the VM, then the VM runs `docker load` and `docker compose up --no-build`. This avoids the slow and unreliable VM-side `npm ci` and Go build path found during the first manual release.

The GitHub-hosted deploy runner reaches the VM through Google IAP TCP forwarding. Terraform opens SSH only to the Google-owned IAP source range `35.235.240.0/20`; it does not need to allow GitHub runner IPs on port `22`. Direct SSH can stay limited to your own `/32` or disabled with `ssh_source_ranges = []`.

Do not run Terraform from GitHub Actions with an open `web_source_ranges = ["0.0.0.0/0"]` after the first public certificate is issued. The Terraform module default is Cloudflare IPv4-only origin access so an apply without production-specific tfvars does not reopen the VM origin. Use `0.0.0.0/0` only as an intentional, temporary override for first certificate issuance or direct origin debugging.

## GCP Access Model

The current low-cost deployment model does not require a GitHub-hosted GCP service account key. GitHub Actions authenticates with Workload Identity Federation, transfers prebuilt Docker image archives through IAP, and runs Docker Compose locally on the VM.

Recommended GCP setup:

- Create a dedicated GitHub Actions deploy service account with Workload Identity Federation.
- Grant that service account `roles/iap.tunnelResourceAccessor`, `roles/compute.viewer`, and `roles/compute.osAdminLogin` in the project, plus `roles/iam.serviceAccountUser` on the VM service account.
- Do not store broad GCP owner/editor keys in GitHub secrets.
- Keep VM firewall rules limited to SSH from IAP/trusted admin source ranges and HTTP/HTTPS from Cloudflare.
- Run Terraform from GitHub with Workload Identity Federation and a narrowly scoped service account instead of a JSON key.

Terraform plan runs in a separate manual GitHub Actions workflow named `Terraform Plan`. It requires a dedicated GCS remote state bucket and Workload Identity Federation. The workflow prints the plan in the Actions log, writes it to the run summary, and uploads the full plan as an artifact. It does not run `terraform apply`.

The deploy workflow also calls the same Terraform plan workflow before the `production` approval gate. Reviewers should inspect the deploy run summary or the `terraform-plan` artifact before approving production.

Before enabling any Terraform apply workflow:

- migrate local Terraform state to the GCS backend,
- configure the GitHub `terraform` environment variables and secrets documented in `infra/gcp/README.md`,
- run `Terraform Plan` and review the plan output in GitHub,
- keep production apply behind a protected GitHub environment approval.

Possible future Terraform CI service account roles:

- `roles/compute.admin` scoped to the deployment project only when VM lifecycle changes are automated.
- `roles/dns.admin` only if DNS zones are managed from CI.
- `roles/iam.serviceAccountUser` only for attaching service accounts to managed resources.

For now, Terraform apply should continue to be run manually from a trusted local machine until an apply workflow is explicitly added and protected. The GitHub workflow only publishes reviewable plan output.

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
docker load -i /tmp/known-good-portfolio-images.tar.gz
docker compose --env-file .env -f compose.yml up -d --no-build
docker compose --env-file .env -f compose.yml ps
```

With the prebuilt-image deploy path, checking out an older commit on the VM is not enough by itself because Compose will keep using the images currently loaded under the project tags. Prefer re-running the GitHub deploy workflow from a known-good commit, or load a known-good image archive before running `docker compose up --no-build`.

If database state is corrupted, restore from the latest dump created by `deploy/compose/backup-postgres.sh`.
Use `deploy/compose/restore-postgres.sh` for this operation. It requires `CONFIRM_RESTORE=I_UNDERSTAND_THIS_OVERWRITES_DATABASE` and creates a pre-restore backup by default.

## Approval Checklist

Before approving production:

- PR CI passed on the merged change.
- Staging deployment completed successfully.
- Staging `/api/healthz` passed.
- Staging `/mcp` returned `401` without a bearer token.
- Staging Playwright E2E passed against the deployed URL.
- Terraform plan output is visible in the deploy run and has been reviewed.
- The change does not require manual database repair.
- A rollback commit or known good SHA is available.

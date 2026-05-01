# GCP and DNS Deployment Guide

This guide deploys the portfolio platform on a single low-cost Compute Engine VM with Docker Compose, Caddy, Cloudflare DNS, and Cloud Storage backups.

The recommended first production setup is intentionally boring:

- Terraform-managed GCP infrastructure,
- one Compute Engine VM,
- one static external IPv4 address,
- Docker Compose on the VM,
- Caddy as the public TLS reverse proxy,
- PostgreSQL as a private container,
- Cloudflare Free for DNS/proxy/basic edge protection,
- a Cloud Storage bucket for off-VM backups,
- a monthly billing budget alert.

## Cost Target

Target monthly cost: **50 PLN max**.

Recommended Free Tier path:

- Region: `us-central1`, `us-east1`, or `us-west1`.
- Machine: `e2-micro`.
- Boot disk: `30GB` standard persistent disk or smaller.
- No Cloud SQL, no GKE, no external load balancer.
- Cloudflare Free plan.
- Small Cloud Storage backup bucket with lifecycle deletion.

Google Cloud Free Tier includes one non-preemptible `e2-micro` VM per month in selected US regions, 30 GB-months standard persistent disk, and limited outbound data transfer. If you choose a European region for lower latency, treat the VM and disk as billable and verify the total in the Google Cloud pricing calculator before launch.

## Source References

- Google Cloud Free Tier: https://cloud.google.com/free/docs/free-cloud-features
- Compute Engine E2 machine types: https://cloud.google.com/compute/docs/general-purpose-machines
- Static external IP addresses: https://cloud.google.com/compute/docs/ip-addresses/reserve-static-external-ip-address
- Compute Engine firewall rules: https://cloud.google.com/compute/docs/samples/compute-firewall-create
- OS Login: https://cloud.google.com/compute/docs/oslogin/set-up-oslogin
- Billing budgets: https://cloud.google.com/billing/docs/how-to/budgets
- Cloud Storage lifecycle: https://cloud.google.com/storage/docs/lifecycle
- Cloudflare DNS records: https://developers.cloudflare.com/dns/manage-dns-records/
- Cloudflare Full strict SSL mode: https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/

## Terraform Variables

Infrastructure lives in `infra/gcp`. Start from the example variables file:

```bash
cd infra/gcp
cp terraform.tfvars.example terraform.tfvars
```

Recommended first values:

```hcl
project_id         = "your-gcp-project-id"
region             = "us-central1"
zone               = "us-central1-a"
name_prefix        = "portfolio"
domain             = "bpajor.dev"
backup_bucket_name = "bpajor-portfolio-backups-unique-suffix"
```

For the lowest-cost Free Tier setup, keep the VM in a supported US Free Tier region. If the domain or audience later needs EU latency, move to an EU region only after checking the recurring cost.

## 1. Project Setup

Create or select a dedicated GCP project in the Google Cloud Console, link billing, and authenticate locally:

```bash
gcloud auth application-default login
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable serviceusage.googleapis.com
```

Terraform enables the required Compute Engine, Cloud Storage, Cloud Billing, and Billing Budgets APIs.

## 2. Terraform Apply

From `infra/gcp`:

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

Terraform creates:

- custom VPC and subnet,
- static external IPv4 address,
- `e2-micro` VM with Debian 12,
- OS Login project metadata,
- public firewall rule only for ports `80` and `443`,
- optional direct SSH firewall rule when `ssh_source_ranges` is set,
- VM service account,
- Cloud Storage backup bucket with lifecycle deletion,
- optional billing budget when `enable_billing_budget = true`.

Get the important outputs:

```bash
terraform output static_ip
terraform output -raw ssh_command
terraform output backup_bucket
terraform output cloudflare_dns_records
```

## 3. Billing Guardrail

The Terraform stack can create a monthly budget when you set:

```hcl
enable_billing_budget = true
billing_account_id    = "000000-000000-000000"
budget_currency_code  = "PLN"
budget_amount_units   = "50"
```

If billing budget permissions are annoying during first setup, create the budget manually in the Google Cloud Console before `terraform apply`, then keep `enable_billing_budget = false`.

Budgets do not hard-stop spend by default; they alert you. Treat the budget as an alarm, not a circuit breaker.

## 4. Access Model

Terraform enables OS Login so SSH access is tied to Google IAM instead of long-lived metadata SSH keys.

Grant yourself OS Login access if needed:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:YOUR_EMAIL@example.com" \
  --role="roles/compute.osAdminLogin"
```

Prefer enabling 2-Step Verification on the Google account. For a one-person project this is a good security-to-effort tradeoff.

Direct SSH is not opened unless `ssh_source_ranges` contains at least one CIDR. For example:

```hcl
ssh_source_ranges = ["YOUR_PUBLIC_IP/32"]
```

## 5. Network and Static IP

The Terraform stack reserves the static IP and attaches it to the VM. Use the `static_ip` output in Cloudflare DNS.

Important cost note: a static external IP can cost money when reserved but not attached to a running VM. Release it if you destroy or stop using the deployment permanently.

## 6. VM Size

`e2-micro` has limited CPU and 1 GB memory. That is acceptable for a low-traffic portfolio if the Compose stack is kept small. If builds are too heavy on the VM, build locally or in CI and deploy artifacts/images later.

## 7. Bootstrap the VM

SSH into the VM:

```bash
cd infra/gcp
$(terraform output -raw ssh_command)
```

The repository contains a bootstrap script for Debian 12 VMs. It installs base packages, Docker Engine, Docker Compose, creates a deploy user, clones separate staging and production working copies, and creates initial `.env` files:

```bash
curl -fsSL https://raw.githubusercontent.com/bpajor/portfolio/main/deploy/vm/bootstrap-debian.sh -o bootstrap-debian.sh
sudo bash bootstrap-debian.sh
```

Log out and back in if your user needs fresh Docker group membership, then verify:

```bash
docker version
docker compose version
```

Default directories:

- staging: `/opt/portfolio-staging`
- production: `/opt/portfolio-production`

Edit both `.env` files before the first deploy.

Generate initial environment files with strong random secrets:

```bash
cd /opt/portfolio-staging/deploy/compose
sudo -u portfolio DOMAIN=bpajor.dev ADMIN_EMAIL=blazej122@vp.pl TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET BACKUP_BUCKET=gs://YOUR_BACKUP_BUCKET ./generate-env.sh staging > .env
./validate-env.sh staging .env
./preflight.sh staging .env

cd /opt/portfolio-production/deploy/compose
sudo -u portfolio DOMAIN=bpajor.dev ADMIN_EMAIL=blazej122@vp.pl TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET BACKUP_BUCKET=gs://YOUR_BACKUP_BUCKET ./generate-env.sh production > .env
./validate-env.sh production .env
./preflight.sh production .env
```

## 8. Deploy Application

If you used the bootstrap script, the repository already exists in `/opt/portfolio-staging` and `/opt/portfolio-production`.

For manual setup, clone the repository:

```bash
git clone https://github.com/bpajor/portfolio.git
cd portfolio/deploy/compose
cp .env.example .env
```

Edit `.env`:

```bash
SITE_ADDRESS=bpajor.dev
NEXT_PUBLIC_SITE_URL=https://bpajor.dev
NEXT_PUBLIC_API_BASE_URL=/api
API_ALLOWED_ORIGINS=https://bpajor.dev
API_COOKIE_SECURE=true
MCP_ALLOWED_ORIGINS=https://bpajor.dev
```

Generate strong secrets:

```bash
openssl rand -base64 32
```

Replace:

- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `TURNSTILE_SECRET_KEY`
- `MCP_BEARER_TOKEN`
- `MCP_ADMIN_BEARER_TOKEN`

Start the stack:

```bash
./validate-env.sh production .env
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
```

Check the API:

```bash
curl -fsS https://bpajor.dev/api/healthz
BASE_URL=https://bpajor.dev ./smoke-check.sh
```

Check that MCP is protected:

```bash
curl -i https://bpajor.dev/mcp
```

Expected result without a bearer token: `401 Unauthorized`.

## 9. Cloudflare DNS

In Cloudflare DNS, create:

| Type | Name | Content | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| `A` | `@` | VM static IPv4 | Proxied | Auto |
| `CNAME` | `www` | `bpajor.dev` | Proxied | Auto |

Recommended Cloudflare SSL/TLS setting:

- Mode: **Full (strict)**.

Caddy will obtain a public certificate for the origin. Full strict makes Cloudflare validate the certificate presented by the VM. Do not use Flexible mode for this app because the admin panel and API use authenticated traffic.

## 10. Caddy HTTPS

Caddy handles certificate issuance automatically when:

- `SITE_ADDRESS` is a real domain, not `:80`,
- DNS points to the VM,
- ports `80` and `443` reach the VM,
- Cloudflare SSL mode is compatible with origin HTTPS.

Useful commands:

```bash
docker compose --env-file .env -f compose.yml logs -f caddy
docker compose --env-file .env -f compose.yml restart caddy
```

If certificate issuance fails, temporarily set the Cloudflare DNS record to DNS-only, wait for Caddy to issue the certificate, then switch it back to proxied.

## 11. Backups

Terraform creates the Cloud Storage bucket and lifecycle deletion rule.

Run local database dump on the VM:

```bash
cd ~/portfolio/deploy/compose
./backup-postgres.sh
```

Upload the newest dump to Cloud Storage:

```bash
BACKUP_BUCKET=gs://YOUR_BACKUP_BUCKET ./backup-to-gcs.sh
```

Add this to cron after the first manual restore test:

```bash
crontab -e
```

Example nightly job:

```cron
15 3 * * * cd /opt/portfolio-production/deploy/compose && ./backup-to-gcs.sh
```

Or install the cron file with the helper:

```bash
cd /opt/portfolio-production
sudo APP_DIR=/opt/portfolio-production DEPLOY_USER=portfolio ./deploy/vm/install-backup-cron.sh
```

Test restore before relying on backups. On a disposable staging stack:

```bash
cd /opt/portfolio-staging/deploy/compose
CONFIRM_RESTORE=I_UNDERSTAND_THIS_OVERWRITES_DATABASE \
RESTORE_DUMP=./backups/portfolio-postgres-YYYYMMDDTHHMMSSZ.dump \
./restore-postgres.sh
BASE_URL=http://127.0.0.1:18080 ./smoke-check.sh
```

## 12. Update Deployment

On the VM:

```bash
cd ~/portfolio
git fetch origin main
git checkout main
git pull --ff-only
cd deploy/compose
docker compose --env-file .env -f compose.yml up -d --build
docker compose --env-file .env -f compose.yml ps
```

Rollback to the previous commit if needed:

```bash
git log --oneline -5
git checkout PREVIOUS_COMMIT
cd deploy/compose
docker compose --env-file .env -f compose.yml up -d --build
```

## 13. Launch Security Checklist

Before pointing the real domain at the VM:

- Billing budget exists and sends alerts.
- VM is `e2-micro` in a Free Tier eligible US region unless you intentionally accepted EU-region cost.
- Only ports `80` and `443` are open to `0.0.0.0/0`.
- SSH is restricted to your IP, OS Login, or IAP.
- PostgreSQL has no public port.
- `.env` contains strong unique secrets.
- `API_COOKIE_SECURE=true` in production.
- `MCP_BEARER_TOKEN` and `MCP_ADMIN_BEARER_TOKEN` are different.
- Cloudflare DNS is proxied for `@` and `www`.
- Cloudflare SSL/TLS mode is Full strict after Caddy has a valid certificate.
- `/api/healthz` returns `status=ok` and `database=ok`.
- `/mcp` returns `401` without a token.
- A backup dump exists locally and in Cloud Storage.
- A restore has been tested at least once before relying on backups.

## 14. Expected Monthly Cost Shape

Free Tier setup in a supported US region should be near zero for the VM and standard disk within limits, excluding usage outside Free Tier and any future paid services.

Costs that can break the 50 PLN target:

- choosing a non-Free-Tier region,
- using `e2-small` or larger full-time,
- switching to Cloud SQL,
- adding a load balancer,
- keeping unattached static IPs,
- storing too many backups without lifecycle deletion,
- unexpected outbound traffic.

When traffic grows, the next sensible upgrades are:

1. Move backups to a more explicit scheduled job with monitoring.
2. Build images in CI instead of on the VM.
3. Move PostgreSQL to Cloud SQL only when operational value justifies the cost.
4. Move to GKE only when a single VM becomes an actual bottleneck.

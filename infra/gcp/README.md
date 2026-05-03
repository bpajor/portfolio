# GCP Terraform

This Terraform stack provisions the low-cost GCP infrastructure for the portfolio:

- custom VPC and subnet,
- static external IPv4 address,
- Compute Engine VM for Docker Compose,
- HTTP/HTTPS firewall rule,
- optional direct SSH firewall rule,
- OS Login metadata,
- VM service account,
- Cloud Storage backup bucket with lifecycle deletion,
- optional monthly billing budget.

## Free Tier Defaults

The defaults intentionally target the Compute Engine Free Tier:

- `region = "us-central1"`
- `zone = "us-central1-a"`
- `machine_type = "e2-micro"`
- `boot_disk_size_gb = 30`
- `boot_disk_type = "pd-standard"`

If you move to a European region, verify the monthly cost first.

The Terraform variables intentionally reject non-Free-Tier regions, larger machine types, larger boot disks, and non-standard boot disks for the initial release. Loosen those guardrails in a separate PR only after accepting the recurring cost.

## Usage

Enable the Service Usage API once in the project if this is a completely fresh GCP project:

```bash
gcloud services enable serviceusage.googleapis.com
```

```bash
cd infra/gcp
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`, then run:

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

Pull request CI runs non-mutating checks with `terraform init -backend=false`, `terraform fmt -check -recursive`, and `terraform validate`.

The runtime Terraform backend is GCS. Before running Terraform from GitHub Actions, migrate the existing local state into a dedicated state bucket:

```bash
gcloud storage buckets create gs://YOUR_TERRAFORM_STATE_BUCKET \
  --project YOUR_PROJECT_ID \
  --location us-central1 \
  --uniform-bucket-level-access

gcloud storage buckets update gs://YOUR_TERRAFORM_STATE_BUCKET --versioning

terraform init \
  -migrate-state \
  -backend-config="bucket=YOUR_TERRAFORM_STATE_BUCKET" \
  -backend-config="prefix=portfolio/infra/gcp"
```

Do not use the application backup bucket as the Terraform state bucket. Keep infrastructure state separate from database backups.

The manual `Terraform Plan` workflow in GitHub Actions authenticates with GCP through Workload Identity Federation, runs `terraform plan`, prints the plan in the job log, writes it to the run summary, and uploads the full plan as an artifact. It intentionally does not run `terraform apply`.

Required GitHub `terraform` environment variables:

- `GCP_PROJECT_ID`: `bpajor-portfolio-prod`
- `TERRAFORM_STATE_BUCKET`: dedicated GCS bucket name for Terraform state, without `gs://`
- `TERRAFORM_STATE_PREFIX`: `portfolio/infra/gcp`
- `TF_VAR_BACKUP_BUCKET_NAME`: `bpajor-portfolio-prod-backups`
- `TF_VAR_SSH_SOURCE_RANGES`: JSON list of current SSH CIDRs, for example `["194.152.56.130/32"]`

Required GitHub `terraform` environment secrets:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_TERRAFORM_SERVICE_ACCOUNT`

After apply, use the `static_ip` output to create Cloudflare DNS records. Then bootstrap the VM with `deploy/vm/bootstrap-debian.sh`; the full flow is documented in `docs/gcp-dns-deployment.md`.

## SSH

The stack enables OS Login. Connect with the output command:

```bash
terraform output -raw ssh_command
```

If `ssh_source_ranges` is empty, direct SSH port `22` is not opened by Terraform. Use Google Cloud Console SSH, IAP, or temporarily add your current public IP as `/32`.

GitHub-hosted Actions deployments use direct SSH in the current workflow. Before setting `DEPLOY_ENABLED=true`, make sure `ssh_source_ranges` includes the deploy runner source CIDR, or use a self-hosted runner/manual deploy path.

## Backups

The VM service account has object admin access only to the configured backup bucket. The application backup script still runs on the VM:

```bash
cd ~/portfolio/deploy/compose
./backup-postgres.sh
gcloud storage cp "$(ls -t backups/portfolio-postgres-*.dump | head -n 1)" "gs://YOUR_BACKUP_BUCKET/"
```

## State

Terraform state should live in a dedicated GCS backend before any GitHub Actions plan or apply workflow is used. Local state is acceptable only for the first manual bootstrap and must be migrated before CI/CD becomes the source of truth.

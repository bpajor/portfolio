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

After apply, use the `static_ip` output to create Cloudflare DNS records. Then bootstrap the VM with `deploy/vm/bootstrap-debian.sh`; the full flow is documented in `docs/gcp-dns-deployment.md`.

## SSH

The stack enables OS Login. Connect with the output command:

```bash
terraform output -raw ssh_command
```

If `ssh_source_ranges` is empty, direct SSH port `22` is not opened by Terraform. Use Google Cloud Console SSH, IAP, or temporarily add your current public IP as `/32`.

## Backups

The VM service account has object admin access only to the configured backup bucket. The application backup script still runs on the VM:

```bash
cd ~/portfolio/deploy/compose
./backup-postgres.sh
gcloud storage cp "$(ls -t backups/portfolio-postgres-*.dump | head -n 1)" "gs://YOUR_BACKUP_BUCKET/"
```

## State

For one-person early development, local state is acceptable if it is backed up privately. Before CI/CD or collaboration, move Terraform state to a remote backend, for example a dedicated GCS bucket with versioning.

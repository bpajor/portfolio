variable "project_id" {
  description = "GCP project ID that will host the portfolio."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must look like a valid GCP project ID, for example bpajor-portfolio-prod."
  }
}

variable "region" {
  description = "GCP region. Use us-central1, us-east1, or us-west1 to stay aligned with Compute Engine Free Tier."
  type        = string
  default     = "us-central1"

  validation {
    condition     = contains(["us-central1", "us-east1", "us-west1"], var.region)
    error_message = "region must be us-central1, us-east1, or us-west1 to stay aligned with the Compute Engine Free Tier cost target."
  }
}

variable "zone" {
  description = "GCP zone for the VM."
  type        = string
  default     = "us-central1-a"

  validation {
    condition     = can(regex("^us-(central1|east1|west1)-[a-z]$", var.zone))
    error_message = "zone must be in us-central1, us-east1, or us-west1, for example us-central1-a."
  }
}

variable "name_prefix" {
  description = "Prefix used for GCP resource names."
  type        = string
  default     = "portfolio"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}[a-z0-9]$", var.name_prefix))
    error_message = "name_prefix must be 3-22 lowercase letters, numbers, or dashes, starting with a letter and ending with a letter or number."
  }
}

variable "domain" {
  description = "Primary domain served by the VM."
  type        = string
  default     = "bpajor.dev"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$", var.domain))
    error_message = "domain must be a lowercase DNS name, for example bpajor.dev."
  }
}

variable "machine_type" {
  description = "Compute Engine machine type. e2-micro is the Free Tier-friendly default."
  type        = string
  default     = "e2-micro"

  validation {
    condition     = var.machine_type == "e2-micro"
    error_message = "machine_type must stay e2-micro for the initial low-cost release."
  }
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB. 30 GB standard persistent disk matches the Free Tier limit."
  type        = number
  default     = 30

  validation {
    condition     = var.boot_disk_size_gb >= 10 && var.boot_disk_size_gb <= 30
    error_message = "boot_disk_size_gb must be between 10 and 30 for the initial low-cost release."
  }
}

variable "boot_disk_type" {
  description = "Boot disk type."
  type        = string
  default     = "pd-standard"

  validation {
    condition     = var.boot_disk_type == "pd-standard"
    error_message = "boot_disk_type must be pd-standard for the initial low-cost release."
  }
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to SSH directly to the VM. Required for GitHub-hosted deploys unless you use a self-hosted runner, IAP, or manual VM deploys."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for cidr in var.ssh_source_ranges : can(cidrhost(cidr, 0))
    ])
    error_message = "ssh_source_ranges must contain valid CIDR ranges, for example [\"203.0.113.10/32\"]."
  }
}

variable "web_source_ranges" {
  description = "IPv4 CIDR ranges allowed to reach public HTTP/HTTPS. Keep 0.0.0.0/0 for first Caddy certificate issuance, then switch to Cloudflare IPv4 ranges after DNS is proxied."
  type        = list(string)
  default     = ["0.0.0.0/0"]

  validation {
    condition = length(var.web_source_ranges) > 0 && alltrue([
      for cidr in var.web_source_ranges : can(cidrhost(cidr, 0))
    ])
    error_message = "web_source_ranges must contain at least one valid IPv4 CIDR range."
  }
}

variable "backup_bucket_name" {
  description = "Globally unique Cloud Storage bucket name for database backups."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$", var.backup_bucket_name)) && !startswith(var.backup_bucket_name, "gs://")
    error_message = "backup_bucket_name must be a raw globally unique bucket name without gs://, using lowercase letters, numbers, dots, underscores, or dashes."
  }
}

variable "backup_retention_days" {
  description = "Number of days to retain database backup objects in Cloud Storage."
  type        = number
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 90
    error_message = "backup_retention_days must be between 1 and 90."
  }
}

variable "enable_billing_budget" {
  description = "Whether to create a billing budget. Requires billing_account_id."
  type        = bool
  default     = false
}

variable "billing_account_id" {
  description = "Billing account ID, for example 000000-000000-000000. Required only when enable_billing_budget is true."
  type        = string
  default     = ""

  validation {
    condition     = var.billing_account_id == "" || can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.billing_account_id))
    error_message = "billing_account_id must be empty or use the 000000-000000-000000 format."
  }
}

variable "budget_currency_code" {
  description = "Currency code used by the billing budget."
  type        = string
  default     = "PLN"

  validation {
    condition     = can(regex("^[A-Z]{3}$", var.budget_currency_code))
    error_message = "budget_currency_code must be a three-letter uppercase ISO currency code, for example PLN."
  }
}

variable "budget_amount_units" {
  description = "Whole currency units for the monthly budget alert."
  type        = string
  default     = "50"

  validation {
    condition     = can(regex("^[1-9][0-9]*$", var.budget_amount_units))
    error_message = "budget_amount_units must be a positive whole number encoded as a string."
  }
}

variable "labels" {
  description = "Labels applied to supported resources."
  type        = map(string)
  default = {
    app         = "portfolio"
    managed_by  = "terraform"
    environment = "prod"
  }
}

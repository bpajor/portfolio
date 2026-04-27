variable "project_id" {
  description = "GCP project ID that will host the portfolio."
  type        = string
}

variable "region" {
  description = "GCP region. Use us-central1, us-east1, or us-west1 to stay aligned with Compute Engine Free Tier."
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone for the VM."
  type        = string
  default     = "us-central1-a"
}

variable "name_prefix" {
  description = "Prefix used for GCP resource names."
  type        = string
  default     = "portfolio"
}

variable "domain" {
  description = "Primary domain served by the VM."
  type        = string
  default     = "bpajor.dev"
}

variable "machine_type" {
  description = "Compute Engine machine type. e2-micro is the Free Tier-friendly default."
  type        = string
  default     = "e2-micro"
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB. 30 GB standard persistent disk matches the Free Tier limit."
  type        = number
  default     = 30
}

variable "boot_disk_type" {
  description = "Boot disk type."
  type        = string
  default     = "pd-standard"
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to SSH directly to the VM. Leave empty if using IAP or temporary console access."
  type        = list(string)
  default     = []
}

variable "backup_bucket_name" {
  description = "Globally unique Cloud Storage bucket name for database backups."
  type        = string
}

variable "backup_retention_days" {
  description = "Number of days to retain database backup objects in Cloud Storage."
  type        = number
  default     = 30
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
}

variable "budget_currency_code" {
  description = "Currency code used by the billing budget."
  type        = string
  default     = "PLN"
}

variable "budget_amount_units" {
  description = "Whole currency units for the monthly budget alert."
  type        = string
  default     = "50"
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

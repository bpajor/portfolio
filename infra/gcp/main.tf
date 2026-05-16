data "google_project" "current" {
  project_id = var.project_id
}

locals {
  network_name         = "${var.name_prefix}-vpc"
  subnet_name          = "${var.name_prefix}-subnet"
  vm_name              = "${var.name_prefix}-vm"
  address_name         = "${var.name_prefix}-ip"
  service_account_name = "${var.name_prefix}-vm"
  web_tag              = "${var.name_prefix}-web"
}

resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "iap.googleapis.com",
    "storage.googleapis.com",
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

resource "google_compute_project_metadata_item" "os_login" {
  key   = "enable-oslogin"
  value = "TRUE"

  depends_on = [google_project_service.required]
}

resource "google_compute_network" "main" {
  name                    = local.network_name
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "main" {
  name          = local.subnet_name
  ip_cidr_range = "10.10.0.0/24"
  network       = google_compute_network.main.id
  region        = var.region
}

resource "google_compute_address" "web" {
  name         = local.address_name
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "STANDARD"
}

resource "google_compute_firewall" "allow_web" {
  name        = "${var.name_prefix}-allow-web"
  network     = google_compute_network.main.name
  description = "Allow public HTTP and HTTPS traffic to Caddy."
  direction   = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = var.web_source_ranges
  target_tags   = [local.web_tag]
}

resource "google_compute_firewall" "allow_ssh_admin" {
  count = length(var.ssh_source_ranges) > 0 ? 1 : 0

  name        = "${var.name_prefix}-allow-ssh-admin"
  network     = google_compute_network.main.name
  description = "Allow direct SSH only from explicit admin CIDR ranges."
  direction   = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = [local.web_tag]
}

resource "google_compute_firewall" "allow_ssh_iap" {
  name        = "${var.name_prefix}-allow-ssh-iap"
  network     = google_compute_network.main.name
  description = "Allow SSH only through Google IAP TCP forwarding."
  direction   = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.iap_ssh_source_ranges
  target_tags   = [local.web_tag]
}

resource "google_service_account" "vm" {
  account_id   = local.service_account_name
  display_name = "Portfolio VM service account"
  description  = "Least-purpose service account for the single-VM portfolio deployment."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "github_deploy" {
  count = var.enable_github_iap_deploy ? 1 : 0

  account_id   = "${var.name_prefix}-github-deploy"
  display_name = "Portfolio GitHub deploy service account"
  description  = "GitHub Actions service account for IAP-based VM deployment."

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "github_deploy_compute_viewer" {
  count = var.enable_github_iap_deploy ? 1 : 0

  project = var.project_id
  role    = "roles/compute.viewer"
  member  = "serviceAccount:${google_service_account.github_deploy[0].email}"
}

resource "google_project_iam_member" "github_deploy_iap_tunnel" {
  count = var.enable_github_iap_deploy ? 1 : 0

  project = var.project_id
  role    = "roles/iap.tunnelResourceAccessor"
  member  = "serviceAccount:${google_service_account.github_deploy[0].email}"
}

resource "google_project_iam_member" "github_deploy_os_admin" {
  count = var.enable_github_iap_deploy ? 1 : 0

  project = var.project_id
  role    = "roles/compute.osAdminLogin"
  member  = "serviceAccount:${google_service_account.github_deploy[0].email}"
}

resource "google_service_account_iam_member" "github_deploy_vm_service_account_user" {
  count = var.enable_github_iap_deploy ? 1 : 0

  service_account_id = google_service_account.vm.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deploy[0].email}"
}

resource "google_service_account_iam_member" "github_deploy_wif" {
  count = var.enable_github_iap_deploy ? 1 : 0

  service_account_id = google_service_account.github_deploy[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${var.github_actions_workload_identity_pool_id}/attribute.repository/${var.github_actions_repository}"
}

resource "google_storage_bucket" "backups" {
  name                        = var.backup_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  labels                      = var.labels

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age = var.backup_retention_days
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_iam_member" "vm_backup_writer" {
  bucket = google_storage_bucket.backups.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_artifact_registry_repository" "images" {
  location               = var.region
  repository_id          = "${var.name_prefix}-images"
  description            = "Docker images for portfolio deployments."
  format                 = "DOCKER"
  labels                 = var.labels
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "keep-last-five-versions"
    action = "KEEP"

    most_recent_versions {
      package_name_prefixes = [
        "portfolio-staging-web",
        "portfolio-staging-api",
        "portfolio-staging-mcp",
        "portfolio-production-web",
        "portfolio-production-api",
        "portfolio-production-mcp",
      ]
      keep_count = 5
    }
  }

  cleanup_policies {
    id     = "delete-older-tagged-versions"
    action = "DELETE"

    condition {
      tag_state  = "TAGGED"
      older_than = "86400s"
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "86400s"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository_iam_member" "vm_image_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_artifact_registry_repository_iam_member" "github_deploy_image_writer" {
  count = var.enable_github_iap_deploy ? 1 : 0

  project    = var.project_id
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_deploy[0].email}"
}

resource "google_compute_instance" "web" {
  name         = local.vm_name
  machine_type = var.machine_type
  zone         = var.zone
  tags         = [local.web_tag]
  labels       = var.labels

  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = var.boot_disk_size_gb
      type  = var.boot_disk_type
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id

    access_config {
      nat_ip       = google_compute_address.web.address
      network_tier = "STANDARD"
    }
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  lifecycle {
    precondition {
      condition     = startswith(var.zone, "${var.region}-")
      error_message = "zone must belong to region, for example region us-central1 with zone us-central1-a."
    }
  }

  depends_on = [
    google_compute_firewall.allow_web,
    google_compute_firewall.allow_ssh_iap,
    google_compute_project_metadata_item.os_login,
    google_artifact_registry_repository_iam_member.vm_image_reader,
    google_storage_bucket_iam_member.vm_backup_writer,
  ]
}

resource "google_billing_budget" "monthly" {
  count = var.enable_billing_budget ? 1 : 0

  billing_account = var.billing_account_id
  display_name    = "${var.name_prefix}-monthly-budget"

  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency_code
      units         = var.budget_amount_units
    }
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.8
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.2
    spend_basis       = "FORECASTED_SPEND"
  }

  lifecycle {
    precondition {
      condition     = trimspace(var.billing_account_id) != ""
      error_message = "billing_account_id is required when enable_billing_budget is true."
    }
  }
}

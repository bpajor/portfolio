output "vm_name" {
  description = "Compute Engine VM name."
  value       = google_compute_instance.web.name
}

output "vm_zone" {
  description = "Compute Engine VM zone."
  value       = google_compute_instance.web.zone
}

output "static_ip" {
  description = "Static external IPv4 address for Cloudflare DNS."
  value       = google_compute_address.web.address
}

output "backup_bucket" {
  description = "Cloud Storage bucket for PostgreSQL backups."
  value       = google_storage_bucket.backups.url
}

output "vm_service_account" {
  description = "Service account attached to the VM."
  value       = google_service_account.vm.email
}

output "github_deploy_service_account" {
  description = "GitHub Actions deploy service account for IAP-based deployments."
  value       = var.enable_github_iap_deploy ? google_service_account.github_deploy[0].email : null
}

output "github_workload_identity_provider" {
  description = "Workload Identity Provider resource name for GitHub Actions."
  value       = "projects/${data.google_project.current.number}/locations/global/workloadIdentityPools/${var.github_actions_workload_identity_pool_id}/providers/${var.github_actions_workload_identity_provider_id}"
}

output "ssh_command" {
  description = "Command for SSH access through gcloud."
  value       = "gcloud compute ssh ${google_compute_instance.web.name} --zone ${var.zone}"
}

output "iap_ssh_command" {
  description = "Command for SSH access through Google IAP TCP forwarding."
  value       = "gcloud compute ssh ${google_compute_instance.web.name} --zone ${var.zone} --tunnel-through-iap"
}

output "cloudflare_dns_records" {
  description = "DNS records to create in Cloudflare."
  value = {
    apex = {
      type    = "A"
      name    = "@"
      value   = google_compute_address.web.address
      proxied = true
    }
    www = {
      type    = "CNAME"
      name    = "www"
      value   = var.domain
      proxied = true
    }
  }
}

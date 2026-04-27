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

output "ssh_command" {
  description = "Command for SSH access through gcloud."
  value       = "gcloud compute ssh ${google_compute_instance.web.name} --zone ${var.zone}"
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

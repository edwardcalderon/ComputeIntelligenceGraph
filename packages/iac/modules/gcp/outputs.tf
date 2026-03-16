output "instance_id" {
  description = "GCP compute instance name"
  value       = google_compute_instance.cig_node.name
}

output "public_ip" {
  description = "Public IP address of the CIG control node"
  value       = google_compute_instance.cig_node.network_interface[0].access_config[0].nat_ip
}

output "dashboard_url" {
  description = "URL to access the CIG dashboard"
  value       = "http://${google_compute_instance.cig_node.network_interface[0].access_config[0].nat_ip}:3000"
}

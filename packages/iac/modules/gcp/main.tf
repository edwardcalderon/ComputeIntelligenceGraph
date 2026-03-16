terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project
  region  = var.region
  zone    = var.zone
}

# Firewall rule: allow inbound traffic for CIG services
resource "google_compute_firewall" "cig" {
  name    = "cig-allow-inbound"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["22", "3000", "8080", "7474", "7687"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["cig-managed"]

  description = "Allow inbound traffic for CIG control node"
}

# Service account for CIG discovery (read-only)
resource "google_service_account" "cig_discovery" {
  account_id   = "cig-discovery-sa"
  display_name = "CIG Discovery Service Account"
  project      = var.project
}

resource "google_project_iam_member" "cig_viewer" {
  project = var.project
  role    = "roles/viewer"
  member  = "serviceAccount:${google_service_account.cig_discovery.email}"
}

# Compute instance: e2-micro with 20GB pd-standard boot disk
resource "google_compute_instance" "cig_node" {
  name         = "cig-control-node"
  machine_type = var.machine_type
  zone         = var.zone

  tags = ["cig-managed"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 20
      type  = "pd-standard"

      labels = merge(var.tags, {
        cig-managed = "true"
      })
    }
  }

  network_interface {
    network = "default"

    access_config {
      # Ephemeral public IP
    }
  }

  metadata = {
    startup-script = file("${path.module}/user_data.sh")
  }

  service_account {
    email  = google_service_account.cig_discovery.email
    scopes = ["cloud-platform"]
  }

  labels = merge(var.tags, {
    cig-managed = "true"
  })
}

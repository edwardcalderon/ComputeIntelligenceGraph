variable "domain" {
  description = "FQDN for the Authentik instance (e.g. auth.cig.technology)"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for the domain"
  type        = string
}

variable "authentik_image_tag" {
  description = "Authentik Docker image tag"
  type        = string
  default     = "2024.12.3"
}

variable "ssh_public_key" {
  description = "EC2 SSH public key (leave empty to disable SSH key pair)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_host" {
  description = "SMTP host for Authentik email sending"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP port"
  type        = number
  default     = 587
}

variable "smtp_username" {
  description = "SMTP username"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_password" {
  description = "SMTP password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_from" {
  description = "From address for Authentik emails"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

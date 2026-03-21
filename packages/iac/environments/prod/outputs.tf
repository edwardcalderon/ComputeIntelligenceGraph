output "authentik_url" {
  description = "Public URL for the Authentik SSO instance"
  value       = module.authentik.authentik_url
}

output "issuer_url" {
  description = "OIDC issuer URL (use this in apps)"
  value       = module.authentik.issuer_url
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.authentik.alb_dns_name
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = module.authentik.instance_id
}

output "elastic_ip" {
  description = "Server public IP"
  value       = module.authentik.elastic_ip
}

output "admin_password_secret_arn" {
  description = "Secrets Manager ARN for the Authentik admin password"
  value       = module.authentik.admin_password_secret_arn
  sensitive   = true
}

output "oidc_client_secret_arn" {
  description = "Secrets Manager ARN for the OIDC client credentials"
  value       = module.authentik.oidc_client_secret_arn
  sensitive   = true
}

output "issuer_url" {
  description = "Authentik OIDC issuer URL (used as the issuerUrl in OIDCAdapterConfig)"
  value       = "https://${var.domain}/application/o/"
}

output "oidc_client_id" {
  description = "OIDC client ID stored in Secrets Manager (populated after Authentik bootstrap)"
  value       = jsondecode(aws_secretsmanager_secret_version.oidc_client.secret_string)["client_id"]
}

output "oidc_client_secret" {
  description = "OIDC client secret stored in Secrets Manager (populated after Authentik bootstrap)"
  value       = jsondecode(aws_secretsmanager_secret_version.oidc_client.secret_string)["client_secret"]
  sensitive   = true
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.authentik.dns_name
}

output "authentik_url" {
  description = "Public HTTPS URL for the Authentik instance"
  value       = "https://${var.domain}"
}

output "db_secret_arn" {
  description = "ARN of the Secrets Manager secret containing RDS credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "admin_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Authentik admin password"
  value       = aws_secretsmanager_secret.authentik_admin_password.arn
}

output "oidc_client_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the OIDC client credentials"
  value       = aws_secretsmanager_secret.oidc_client.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster running Authentik"
  value       = aws_ecs_cluster.authentik.name
}

output "ecs_service_name" {
  description = "Name of the ECS service running Authentik"
  value       = aws_ecs_service.authentik.name
}

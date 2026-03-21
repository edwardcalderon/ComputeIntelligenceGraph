output "authentik_url" {
  description = "Public HTTPS URL for the Authentik instance"
  value       = "https://${var.domain}"
}

output "issuer_url" {
  description = "Authentik OIDC issuer URL"
  value       = "https://${var.domain}/application/o/"
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.authentik.dns_name
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.authentik.id
}

output "elastic_ip" {
  description = "Elastic IP of the Authentik server"
  value       = aws_eip.authentik.public_ip
}

output "admin_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Authentik admin password"
  value       = aws_secretsmanager_secret.authentik_admin_password.arn
  sensitive   = true
}

output "oidc_client_secret_arn" {
  description = "ARN of the Secrets Manager secret containing OIDC client credentials"
  value       = aws_secretsmanager_secret.oidc_client.arn
  sensitive   = true
}

output "oidc_client_id" {
  description = "OIDC client ID (placeholder until Authentik is bootstrapped)"
  value       = jsondecode(aws_secretsmanager_secret_version.oidc_client.secret_string)["client_id"]
}

output "oidc_client_secret" {
  description = "OIDC client secret (placeholder until Authentik is bootstrapped)"
  value       = jsondecode(aws_secretsmanager_secret_version.oidc_client.secret_string)["client_secret"]
  sensitive   = true
}

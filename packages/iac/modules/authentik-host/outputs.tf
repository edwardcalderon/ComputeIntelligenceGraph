output "authentik_url" {
  description = "Public HTTPS URL for the Authentik instance"
  value       = "https://${var.domain}"
}

output "issuer_url" {
  description = "Authentik OIDC issuer URL"
  value       = "https://${var.domain}/application/o/${var.oidc_client_id}/"
}

output "token_endpoint" {
  description = "Authentik OIDC token endpoint"
  value       = "https://${var.domain}/application/o/${var.oidc_client_id}/token/"
}

output "jwks_uri" {
  description = "Authentik OIDC JWKS endpoint"
  value       = "https://${var.domain}/application/o/${var.oidc_client_id}/jwks/"
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.authentik.id
}

output "instance_private_ip" {
  description = "Private IP of the Authentik instance"
  value       = aws_instance.authentik.private_ip
}

output "instance_public_ip" {
  description = "Public IP assigned to the Authentik instance"
  value       = aws_instance.authentik.public_ip
}

output "elastic_ip" {
  description = "Elastic IP of the Authentik server"
  value       = aws_eip.authentik.public_ip
}

output "vpc_id" {
  description = "VPC ID hosting the Authentik instance"
  value       = aws_vpc.authentik.id
}

output "subnet_id" {
  description = "Subnet ID hosting the Authentik instance"
  value       = aws_subnet.public.id
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
  description = "OIDC client ID registered in Authentik"
  value       = var.oidc_client_id
}

output "oidc_client_secret" {
  description = "OIDC client secret registered in Authentik"
  value       = jsondecode(aws_secretsmanager_secret_version.oidc_client.secret_string)["client_secret"]
  sensitive   = true
}

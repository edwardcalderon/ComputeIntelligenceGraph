output "instance_id" {
  description = "EC2 instance ID for the API host"
  value       = aws_instance.api_host.id
}

output "instance_public_ip" {
  description = "Public IP assigned to the API host instance"
  value       = aws_instance.api_host.public_ip
}

output "elastic_ip" {
  description = "Elastic IP assigned to the API host"
  value       = aws_eip.api.public_ip
}

output "vpc_id" {
  description = "VPC ID hosting the API host"
  value       = aws_vpc.api.id
}

output "subnet_id" {
  description = "Public subnet ID hosting the API host"
  value       = aws_subnet.public.id
}

output "api_url" {
  description = "Canonical HTTPS URL for the API"
  value       = "https://${var.domain}"
}

output "neo4j_password_secret_arn" {
  description = "Secrets Manager ARN for the Neo4j password"
  value       = aws_secretsmanager_secret.neo4j_password.arn
  sensitive   = true
}

output "secret_prefix" {
  description = "Secrets Manager prefix used by the API host"
  value       = local.secret_prefix
}

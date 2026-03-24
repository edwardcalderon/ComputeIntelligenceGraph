output "vpc_id" {
  description = "VPC ID used by the API runtime stack"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for the API ALB"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks and Neo4j"
  value       = module.networking.private_subnet_ids
}

output "alb_security_group_id" {
  description = "Security group for the public API ALB"
  value       = module.networking.alb_security_group_id
}

output "api_service_security_group_id" {
  description = "Security group for the ECS API service"
  value       = module.networking.api_service_security_group_id
}

output "neo4j_security_group_id" {
  description = "Security group for the Neo4j instance"
  value       = module.networking.neo4j_security_group_id
}

output "neo4j_bolt_uri" {
  description = "Bolt URI exposed by the Neo4j instance"
  value       = module.neo4j.bolt_uri
}

output "neo4j_password_secret_arn" {
  description = "Secrets Manager ARN for the Neo4j password"
  value       = module.neo4j.password_secret_arn
  sensitive   = true
}

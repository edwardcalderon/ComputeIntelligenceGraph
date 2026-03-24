output "vpc_id" {
  description = "VPC ID for API runtime resources"
  value       = aws_vpc.api.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for ALB placement"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks and Neo4j"
  value       = aws_subnet.private[*].id
}

output "alb_security_group_id" {
  description = "Security group ID for the public ALB"
  value       = aws_security_group.alb.id
}

output "api_service_security_group_id" {
  description = "Security group ID for the ECS API service"
  value       = aws_security_group.api_service.id
}

output "neo4j_security_group_id" {
  description = "Security group ID for the Neo4j instance"
  value       = aws_security_group.neo4j.id
}

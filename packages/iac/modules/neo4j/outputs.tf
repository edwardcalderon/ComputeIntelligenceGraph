output "instance_id" {
  description = "EC2 instance ID for Neo4j"
  value       = aws_instance.neo4j.id
}

output "private_ip" {
  description = "Private IP address of the Neo4j instance"
  value       = aws_instance.neo4j.private_ip
}

output "bolt_uri" {
  description = "Bolt URI for the Neo4j instance"
  value       = "bolt://${aws_instance.neo4j.private_ip}:7687"
}

output "password_secret_arn" {
  description = "Secrets Manager ARN containing the Neo4j password"
  value       = aws_secretsmanager_secret.neo4j_password.arn
  sensitive   = true
}

output "data_volume_id" {
  description = "Persistent EBS volume ID attached to Neo4j"
  value       = aws_ebs_volume.data.id
}

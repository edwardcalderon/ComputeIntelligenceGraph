output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.cig_node.id
}

output "public_ip" {
  description = "Public IP address of the CIG control node"
  value       = aws_instance.cig_node.public_ip
}

output "dashboard_url" {
  description = "URL to access the CIG dashboard"
  value       = "http://${aws_instance.cig_node.public_ip}:3000"
}

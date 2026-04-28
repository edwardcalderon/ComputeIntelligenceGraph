output "account_id" {
  description = "AWS account ID used for the bootstrap stack"
  value       = data.aws_caller_identity.current.account_id
}

output "state_bucket" {
  description = "S3 bucket for Terraform state in this account"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "lock_table" {
  description = "DynamoDB lock table for Terraform state"
  value       = aws_dynamodb_table.terraform_locks.name
}

output "route53_zone_id" {
  description = "Hosted zone ID for cig.technology"
  value       = aws_route53_zone.cig.zone_id
}

output "name_servers" {
  description = "Delegation name servers for cig.technology"
  value       = aws_route53_zone.cig.name_servers
}

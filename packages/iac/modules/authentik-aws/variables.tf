variable "vpc_id" {
  description = "Existing VPC ID to deploy into. If empty, a new VPC will be created."
  type        = string
  default     = ""
}

variable "domain" {
  description = "Fully-qualified domain name for the Authentik instance (e.g. auth.example.com)"
  type        = string
}

variable "region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "us-east-1"
}

variable "db_instance_class" {
  description = "RDS instance class for the Authentik PostgreSQL database"
  type        = string
  default     = "db.t3.micro"
}

variable "authentik_image_tag" {
  description = "Authentik Docker image tag (e.g. 2024.2.2)"
  type        = string
  default     = "2024.2.2"
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for the domain"
  type        = string
}

variable "db_name" {
  description = "Name of the PostgreSQL database for Authentik"
  type        = string
  default     = "authentik"
}

variable "db_username" {
  description = "Master username for the RDS PostgreSQL instance"
  type        = string
  default     = "authentik"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for the RDS instance"
  type        = bool
  default     = false
}

variable "ecs_cpu" {
  description = "CPU units for the Authentik ECS Fargate task (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "ecs_memory" {
  description = "Memory (MiB) for the Authentik ECS Fargate task"
  type        = number
  default     = 2048
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

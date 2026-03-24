variable "region" {
  description = "AWS region for the Neo4j instance"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix used for Neo4j resource names"
  type        = string
  default     = "cig-api"
}

variable "instance_type" {
  description = "EC2 instance type for Neo4j"
  type        = string
  default     = "t3.medium"
}

variable "subnet_id" {
  description = "Private subnet ID used for the Neo4j instance"
  type        = string
}

variable "security_group_id" {
  description = "Security group allowing only API-service Bolt traffic"
  type        = string
}

variable "volume_size_gb" {
  description = "Size of the persistent EBS data volume in GiB"
  type        = number
  default     = 100
}

variable "neo4j_version" {
  description = "Neo4j container image version"
  type        = string
  default     = "5.26"
}

variable "tags" {
  description = "Additional tags applied to Neo4j resources"
  type        = map(string)
  default     = {}
}

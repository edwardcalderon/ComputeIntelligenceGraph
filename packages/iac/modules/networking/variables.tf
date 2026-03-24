variable "region" {
  description = "AWS region for networking resources"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix used for networking resource names"
  type        = string
  default     = "cig-api"
}

variable "vpc_cidr" {
  description = "CIDR block for the API VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Optional explicit CIDR blocks for public subnets"
  type        = list(string)
  default     = []
}

variable "private_subnet_cidrs" {
  description = "Optional explicit CIDR blocks for private subnets"
  type        = list(string)
  default     = []
}

variable "api_container_port" {
  description = "Container port exposed by the API service"
  type        = number
  default     = 8080
}

variable "tags" {
  description = "Additional tags applied to networking resources"
  type        = map(string)
  default     = {}
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name_prefix" {
  type    = string
  default = "cig-api"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = []
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = []
}

variable "api_container_port" {
  type    = number
  default = 8080
}

variable "neo4j_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "neo4j_volume_size_gb" {
  type    = number
  default = 100
}

variable "neo4j_version" {
  type    = string
  default = "5.26"
}

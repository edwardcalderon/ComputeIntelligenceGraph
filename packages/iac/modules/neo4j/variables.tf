# TODO: Define Neo4j module input variables
variable "instance_type" {
  description = "EC2 instance type for Neo4j"
  type        = string
  default     = "t3.medium"
}

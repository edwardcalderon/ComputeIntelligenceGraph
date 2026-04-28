variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "domain" {
  description = "Primary public domain to bootstrap"
  type        = string
  default     = "cig.technology"
}

variable "state_bucket_prefix" {
  description = "Terraform state bucket prefix"
  type        = string
  default     = "cig-terraform-state"
}

variable "lock_table_name" {
  description = "Terraform lock table name"
  type        = string
  default     = "cig-terraform-locks"
}

variable "mail_mx_priority" {
  description = "Priority for the apex MX record"
  type        = number
  default     = 10
}

variable "mail_mx_host" {
  description = "Mail exchange host for cig.technology"
  type        = string
  default     = "mail.xn--tlo-fla.com."
}

variable "mail_spf_record" {
  description = "SPF TXT record for the apex domain"
  type        = string
  default     = "v=spf1 mx a:mail.xn--tlo-fla.com ~all"
}

variable "mail_dmarc_record" {
  description = "DMARC TXT record for the domain"
  type        = string
  default     = "v=DMARC1; p=none; rua=mailto:admin@cig.technology"
}

variable "mail_dkim_record" {
  description = "DKIM TXT record for the domain"
  type        = string
  default     = "v=DKIM1; k=ed25519; p=AV2lQGgZ2t2U48BtazkJOiUf4cIQwpBqL8Jskio8Qn8="
}

variable "mail_imaps_port" {
  description = "IMAPS port advertised via SRV"
  type        = number
  default     = 993
}

variable "mail_submission_port" {
  description = "SMTP submission port advertised via SRV"
  type        = number
  default     = 587
}

variable "mail_target_host" {
  description = "Target host for mail SRV and MX records"
  type        = string
  default     = "mail.xn--tlo-fla.com."
}

variable "tags" {
  description = "Additional tags to apply to bootstrap resources"
  type        = map(string)
  default     = {}
}

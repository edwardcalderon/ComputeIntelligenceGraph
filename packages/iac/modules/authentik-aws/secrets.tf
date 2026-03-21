################################################################################
# Authentik secret key (cryptographic key for sessions/tokens)
################################################################################

resource "random_password" "authentik_secret_key" {
  length  = 50
  special = false  # Authentik secret key must be alphanumeric
}

resource "aws_secretsmanager_secret" "authentik_secret_key" {
  name                    = "authentik/${var.domain}/secret-key"
  description             = "Authentik SECRET_KEY for ${var.domain}"
  recovery_window_in_days = 7
  tags                    = merge(var.tags, { Name = "authentik-secret-key", cig-managed = "true" })
}

resource "aws_secretsmanager_secret_version" "authentik_secret_key" {
  secret_id     = aws_secretsmanager_secret.authentik_secret_key.id
  secret_string = random_password.authentik_secret_key.result
}

################################################################################
# Authentik admin bootstrap password
################################################################################

resource "random_password" "authentik_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "authentik_admin_password" {
  name                    = "authentik/${var.domain}/admin-password"
  description             = "Authentik admin password for ${var.domain}"
  recovery_window_in_days = 7
  tags                    = merge(var.tags, { Name = "authentik-admin-password", cig-managed = "true" })
}

resource "aws_secretsmanager_secret_version" "authentik_admin_password" {
  secret_id     = aws_secretsmanager_secret.authentik_admin_password.id
  secret_string = random_password.authentik_admin.result
}

################################################################################
# PostgreSQL password (local on EC2)
################################################################################

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "authentik/${var.domain}/db-password"
  description             = "PostgreSQL password for Authentik on ${var.domain}"
  recovery_window_in_days = 7
  tags                    = merge(var.tags, { Name = "authentik-db-password", cig-managed = "true" })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

################################################################################
# OIDC client credentials (populated post-bootstrap)
################################################################################

resource "aws_secretsmanager_secret" "oidc_client" {
  name                    = "authentik/${var.domain}/oidc-client"
  description             = "OIDC client ID and secret for ${var.domain}"
  recovery_window_in_days = 7
  tags                    = merge(var.tags, { Name = "authentik-oidc-client", cig-managed = "true" })
}

resource "aws_secretsmanager_secret_version" "oidc_client" {
  secret_id = aws_secretsmanager_secret.oidc_client.id
  secret_string = jsonencode({
    client_id     = "placeholder"
    client_secret = "placeholder"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

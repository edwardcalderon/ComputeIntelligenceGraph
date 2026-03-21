################################################################################
# Secrets Manager — Authentik admin password
################################################################################

resource "aws_secretsmanager_secret" "authentik_admin_password" {
  name                    = "authentik/${var.domain}/admin-password"
  description             = "Authentik admin password for ${var.domain}"
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name        = "authentik-admin-password"
    cig-managed = "true"
  })
}

resource "aws_secretsmanager_secret_version" "authentik_admin_password" {
  secret_id = aws_secretsmanager_secret.authentik_admin_password.id
  # Generated at apply time via random_password; rotated externally if needed.
  secret_string = random_password.authentik_admin.result
}

resource "random_password" "authentik_admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

################################################################################
# Secrets Manager — RDS database credentials
################################################################################

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "authentik/${var.domain}/db-credentials"
  description             = "RDS PostgreSQL credentials for Authentik (${var.domain})"
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name        = "authentik-db-credentials"
    cig-managed = "true"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.authentik.address
    port     = 5432
    dbname   = var.db_name
  })
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

################################################################################
# Secrets Manager — OIDC client credentials (populated post-bootstrap)
################################################################################

resource "aws_secretsmanager_secret" "oidc_client" {
  name                    = "authentik/${var.domain}/oidc-client"
  description             = "Authentik OIDC client ID and secret for ${var.domain}"
  recovery_window_in_days = 7

  tags = merge(var.tags, {
    Name        = "authentik-oidc-client"
    cig-managed = "true"
  })
}

resource "aws_secretsmanager_secret_version" "oidc_client" {
  secret_id = aws_secretsmanager_secret.oidc_client.id
  # Placeholder — the Infra deployer updates this after Authentik bootstraps the OIDC provider.
  secret_string = jsonencode({
    client_id     = "placeholder"
    client_secret = "placeholder"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

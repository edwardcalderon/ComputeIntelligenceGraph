################################################################################
# Authentik secret key (cryptographic key for sessions/tokens)
################################################################################

resource "random_password" "authentik_secret_key" {
  length  = 50
  special = false
}

resource "aws_secretsmanager_secret" "authentik_secret_key" {
  name                    = "authentik/${var.domain}/secret-key"
  description             = "CIG Authentik SECRET_KEY for ${var.domain}"
  recovery_window_in_days = 7
  tags = merge(var.tags, {
    Name        = "cig-authentik-sso-secret-key"
    cig-managed = "true"
  })
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
  description             = "CIG Authentik admin password for ${var.domain}"
  recovery_window_in_days = 7
  tags = merge(var.tags, {
    Name        = "cig-authentik-sso-admin-password"
    cig-managed = "true"
  })
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

resource "random_password" "oidc_client_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "authentik/${var.domain}/db-password"
  description             = "CIG Authentik PostgreSQL password for ${var.domain}"
  recovery_window_in_days = 7
  tags = merge(var.tags, {
    Name        = "cig-authentik-sso-db-password"
    cig-managed = "true"
  })
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

################################################################################
# OIDC client credentials (placeholder until the tenant is bootstrapped)
################################################################################

resource "aws_secretsmanager_secret" "oidc_client" {
  name                    = "authentik/${var.domain}/oidc-client"
  description             = "CIG Authentik OIDC client ID and secret for ${var.domain}"
  recovery_window_in_days = 7
  tags = merge(var.tags, {
    Name        = "cig-authentik-sso-oidc-client"
    cig-managed = "true"
  })
}

resource "aws_secretsmanager_secret_version" "oidc_client" {
  secret_id = aws_secretsmanager_secret.oidc_client.id
  secret_string = jsonencode({
    client_id     = var.oidc_client_id
    client_secret = local.resolved_oidc_client_secret
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

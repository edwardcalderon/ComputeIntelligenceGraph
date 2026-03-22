# ─── CIG Production — auth.cig.technology ────────────────────────────────────
# Authentik SSO on EC2 t3.small + Docker Compose (lean/budget setup)
# Stack: EC2 t3.small | 30 GB gp3 | ALB | ACM | Route53

domain          = "auth.cig.technology"
region          = "us-east-1"
route53_zone_id = "Z0810853438OE5M2AKZP"

# Authentik — 2026.2.1 (no Redis required)
authentik_image_tag = "2026.2.1"

# SSH — add your public key here to enable SSH access
# ssh_public_key = "ssh-ed25519 AAAA..."

# SMTP — optional, enables email notifications/password reset
# smtp_host     = "smtp.sendgrid.net"
# smtp_port     = 587
# smtp_username = "apikey"
# smtp_password = "SG...."
# smtp_from     = "noreply@cig.technology"

# Lean production stack for the target AWS account.
# This root expects route53_zone_id and api_image_uri at apply time so it can be
# driven by the migration helper script.
#
# Sizing defaults:
#   API host: t3.medium
#   Authentik host: t3.small
#   Neo4j data: 25 GiB
#
# Secrets are resolved by the host bootstraps; SMTP settings are optional.

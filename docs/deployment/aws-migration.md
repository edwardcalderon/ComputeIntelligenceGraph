# CIG AWS Migration

This is the new-account migration path for CIG.

It uses the CIG AWS credentials from `.env` through `scripts/env/cig-aws.sh` and recreates the minimal stack in order:

1. Bootstrap the new account state bucket, lock table, and `cig.technology` hosted zone.
   The migration helper now resolves the delegated hosted zone by comparing the live name servers for `cig.technology` against the Route 53 zones in the account, so duplicate zones do not break the cutover.
2. Recreate the shared domain mail records in the new hosted zone so SPF, DKIM, DMARC, MX, and IMAPS/submission stay intact.
3. Apply the lean Authentik host first so the OIDC app and social-login flows can seed themselves.
4. Wait for the Authentik bootstrap marker, then verify the Google and GitHub login flows and sync the API runtime secrets into AWS Secrets Manager.
5. Apply the API host stack.
6. Verify both hosts through their bootstrap markers in EC2 console output.

## Entry Point

```bash
make -C packages/iac migrate-account
```

If the API image is not already available from the default Docker Hub tag, pass it explicitly:

```bash
node scripts/migrate-cig-account.mjs --env-file .env --api-image-uri <image-uri>
```

## What It Creates

- S3 bucket for Terraform state
- DynamoDB lock table
- Route 53 hosted zone for `cig.technology`
- Mail DNS records for `cig.technology` so outbound email keeps working after delegation
- Authentik EC2 host with Caddy and blueprint bootstrap, including Google/GitHub social-login flows
- API EC2 host with Neo4j and Caddy
- The AWS Secrets Manager runtime values the API host reads on startup

## After The Run

Delegate the `cig.technology` domain to the Route 53 name servers printed by the script. Until that delegation is updated, the hosts can still be verified through their bootstrap markers, but public HTTPS will not be authoritative.

## Notes

- The script is intentionally idempotent on the Terraform side.
- The repo does not use the machine's default AWS CLI profile for CIG work. Source `scripts/env/cig-aws.sh` or use the Makefile targets so the repo `.env` credentials are loaded explicitly and the active account is checked with STS.
- The Authentik OIDC app and the Google/GitHub social providers are bootstrapped in Terraform, and any future account-specific wiring should follow the same blueprint path.
- This path is the lean minimum for the new account; it avoids ALBs and NAT gateways.

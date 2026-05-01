---
inclusion: always
---

# AWS Account Guardrails

## Target Account

All AWS infrastructure for this workspace MUST be deployed to the **CIG account**:

- **Account ID**: `520900722378`
- **AWS Profile**: `aws-cig`
- **Region**: `us-east-2`

## Rules

1. **Always set `AWS_PROFILE=aws-cig`** when running any AWS CLI command or SST/Pulumi deployment.
2. **Never deploy to the default AWS account** (`058264267235`). That is a personal account and must not receive any CIG resources.
3. When running `sst deploy`, always prefix with `AWS_PROFILE=aws-cig` or ensure the SST config reads `AWS_PROFILE` from `.env`.
4. The `sst.config.ts` must pass `profile` to the AWS provider config so Pulumi targets the correct account.
5. After any deployment, verify the output ARNs contain `520900722378` — not `058264267235`.

## Quick Reference

```bash
# Correct — deploys to CIG account
AWS_PROFILE=aws-cig pnpm run deploy:production

# Verify you're targeting the right account
aws sts get-caller-identity --profile aws-cig

# WRONG — deploys to default personal account
pnpm run deploy:production
```

## Environment Variables (`.env`)

The following must always be set:

```
AWS_PROFILE=aws-cig
AWS_REGION=us-east-2
AWS_ACCOUNT_ID=520900722378
```

## CodeStar Connection

```
INFRA_CODESTAR_CONNECTION_ARN=arn:aws:codestar-connections:us-east-2:520900722378:connection/3ee9f8cd-a6b9-482c-8c41-109c277a4fae
```

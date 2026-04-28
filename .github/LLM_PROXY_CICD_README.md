# LLM Proxy CI/CD Pipeline

This document describes the complete CI/CD pipeline for the AWS-Native LLM Proxy, including infrastructure provisioning, automated deployment, and release management.

## Architecture Overview

```
GitHub Release (llm-proxy-v*.*.*)
    ↓
GitHub Actions Workflow
    ├─ Detect Changes
    ├─ Validate Code (lint, test, build)
    ├─ Build Docker Image (ECR + Docker Hub)
    ├─ Provision Infrastructure (SST)
    │   ├─ SQS Queues
    │   ├─ DynamoDB Table
    │   ├─ Lambda Function
    │   ├─ API Gateway
    │   ├─ IAM Roles
    │   ├─ SNS Topic
    │   └─ CloudWatch Alarms
    ├─ Deploy Lambda & API Gateway
    └─ Smoke Tests
```

## Workflows

### 1. Bootstrap LLM Proxy Infrastructure

**File**: `.github/workflows/bootstrap-llm-proxy.yml`

**Trigger**: Manual workflow dispatch

**Purpose**: Provisions the base infrastructure layer (one-time setup)

**Steps**:
1. Create S3 bucket for SST state
2. Create DynamoDB table for SST state
3. Deploy base infrastructure via SST
4. Optionally create AWS CodePipeline

**Usage**:
```bash
# Via GitHub UI
1. Go to Actions → Bootstrap LLM Proxy infrastructure
2. Click "Run workflow"
3. Optionally enable "Create AWS CodePipeline"
4. Click "Run workflow"
```

### 2. Deploy LLM Proxy

**File**: `.github/workflows/deploy-llm-proxy.yml`

**Trigger**: 
- Push with tag matching `llm-proxy-v*.*.*`
- Manual workflow dispatch

**Purpose**: Builds, tests, and deploys the LLM Proxy

**Steps**:
1. Detect changes to LLM Proxy files
2. Validate code (lint, test, build)
3. Build Docker image
4. Provision/update infrastructure
5. Run smoke tests
6. Generate deployment summary

**Usage**:
```bash
# Create a release
git tag llm-proxy-v1.0.0
git push origin llm-proxy-v1.0.0

# Or via GitHub UI
1. Go to Releases → Create a new release
2. Select tag: llm-proxy-v1.0.0
3. Add release notes
4. Publish release
```

## File Structure

```
.github/
├── workflows/
│   ├── bootstrap-llm-proxy.yml          # Bootstrap infrastructure
│   └── deploy-llm-proxy.yml             # Deploy releases
├── LLMPROXY_DEPLOYMENT_GUIDE.md         # User-facing deployment guide
└── LLM_PROXY_CICD_README.md             # This file

scripts/
└── detect-llm-proxy-impact.mjs          # Change detection script

packages/llm-proxy/
├── Dockerfile                           # Docker image definition
├── package.json                         # Updated with deploy scripts
├── sst.config.ts                        # SST configuration
├── infra/
│   └── index.ts                         # Infrastructure definitions
├── src/
│   ├── index.ts                         # Lambda handler
│   ├── types.ts                         # TypeScript types
│   ├── lib/                             # Core libraries
│   ├── routes/                          # API routes
│   └── schemas/                         # Zod schemas
└── scripts/
    └── bootstrap-llm-proxy.sh           # Bootstrap script
```

## Environment Variables

### GitHub Actions Secrets

Required:
- `AWS_ROLE_TO_ASSUME`: ARN of IAM role for GitHub Actions

Optional:
- `DOCKERHUB_TOKEN`: Docker Hub authentication token

### GitHub Actions Variables

Optional (with defaults):
- `AWS_REGION`: AWS region (default: `us-east-2`)
- `LLM_PROXY_DOMAIN`: Domain name (default: `llm-proxy.cig.technology`)
- `LLM_PROXY_IMAGE_REPOSITORY`: ECR repository (default: `llm-proxy-production`)
- `DOCKERHUB_USERNAME`: Docker Hub username (default: `cigtechnology`)
- `DOCKERHUB_LLM_PROXY_IMAGE`: Docker Hub image (default: `llm-proxy`)
- `LLM_PROXY_HOSTED_ZONE_DOMAIN`: Route 53 hosted zone (default: `cig.technology`)

## Change Detection

The pipeline uses `scripts/detect-llm-proxy-impact.mjs` to determine what changed:

**Source Changes** (triggers build):
- `packages/llm-proxy/src/**`
- `packages/llm-proxy/package.json`
- `packages/llm-proxy/tsconfig.json`

**Runtime Changes** (triggers infrastructure update):
- `packages/llm-proxy/infra/**`
- `packages/llm-proxy/sst.config.ts`
- `packages/llm-proxy/sst-env.d.ts`

## Deployment Process

### Phase 1: Detection & Validation

```
detect-llm-proxy-impact
├─ Check for source changes
├─ Check for runtime changes
└─ Determine if deployment needed

validate
├─ Lint code
├─ Run tests
└─ Build application
```

### Phase 2: Image Building

```
build-image
├─ Resolve ECR repository URI
├─ Create ECR repository (if needed)
├─ Build Docker image
├─ Push to ECR
└─ Push to Docker Hub (optional)
```

### Phase 3: Infrastructure Provisioning

```
provision-base-infrastructure
├─ Deploy SQS queues
├─ Deploy DynamoDB table
├─ Deploy Lambda function
├─ Deploy API Gateway
├─ Configure IAM roles
├─ Create SNS topic
└─ Set up CloudWatch alarms
```

### Phase 4: Testing & Summary

```
smoke-test
├─ Test /health endpoint
└─ Test /v1/models endpoint

deployment-summary
└─ Generate deployment report
```

## Infrastructure Components

### SQS Queues

| Queue | Purpose | Config |
|-------|---------|--------|
| `llm-proxy-request-queue` | Inference requests | VisibilityTimeout: 120s, Retention: 300s |
| `llm-proxy-response-queue` | Inference responses | VisibilityTimeout: 30s, Retention: 300s |
| `llm-proxy-dlq` | Failed messages | Retention: 14 days |

### DynamoDB Table

| Table | Purpose | Config |
|-------|---------|--------|
| `llm-proxy-state` | Worker sessions | On-demand billing, TTL enabled |

### Lambda Function

| Property | Value |
|----------|-------|
| Name | `llm-proxy-lambda` |
| Runtime | Node.js 20.x |
| Memory | 256 MB |
| Timeout | 90 seconds |
| Handler | `index.handler` |

### API Gateway

| Property | Value |
|----------|-------|
| Name | `llm-proxy-api` |
| Type | HTTP API |
| Routes | `/v1/*`, `/health`, `/admin/*`, `/mcp/*` |

### IAM Roles

| Role | Purpose | Permissions |
|------|---------|-------------|
| `llm-proxy-lambda-role` | Lambda execution | SQS send/receive, DynamoDB read |
| `llm-proxy-worker-user` | Colab worker | SQS receive/send, DynamoDB read/write |

### CloudWatch Alarms

| Alarm | Condition | Action |
|-------|-----------|--------|
| Queue Depth | > 10 for 5 min | SNS notification |
| DLQ Messages | > 0 | SNS notification |
| Lambda Errors | > 5 in 5 min | SNS notification |

## Monitoring & Logs

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/llm-proxy-lambda --follow

# View API Gateway logs
aws logs tail /aws/apigateway/llm-proxy-api --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/llm-proxy-lambda \
  --filter-pattern "ERROR"
```

### CloudWatch Metrics

```bash
# View Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=llm-proxy-lambda \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### SNS Notifications

```bash
# Subscribe to alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-2:ACCOUNT_ID:llm-proxy-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Confirm subscription (check email)
```

## Troubleshooting

### Workflow Failures

1. **Check GitHub Actions logs**:
   - Go to Actions → Deploy LLM Proxy
   - Click the failed run
   - Review step logs

2. **Common issues**:
   - Missing AWS credentials: Check `AWS_ROLE_TO_ASSUME` secret
   - Missing Docker Hub token: Check `DOCKERHUB_TOKEN` secret
   - Insufficient IAM permissions: Check IAM role policy

### Deployment Issues

1. **Lambda function errors**:
   ```bash
   aws lambda get-function-concurrency --function-name llm-proxy-lambda
   aws lambda get-function-configuration --function-name llm-proxy-lambda
   ```

2. **API Gateway issues**:
   ```bash
   aws apigatewayv2 get-apis --query 'Items[?Name==`llm-proxy-api`]'
   aws apigatewayv2 get-routes --api-id <API_ID>
   ```

3. **SQS queue issues**:
   ```bash
   aws sqs get-queue-attributes \
     --queue-url <QUEUE_URL> \
     --attribute-names All
   ```

## Cost Estimation

### Monthly Costs (within free tier)

| Service | Free Tier | Estimated Usage | Cost |
|---------|-----------|-----------------|------|
| Lambda | 1M invocations | 30K invocations | $0 |
| API Gateway | 1M calls | 30K calls | $0 |
| SQS | 1M requests | 120K requests | $0 |
| DynamoDB | 25 RCU/WCU | On-demand | $0 |
| CloudWatch | 10 alarms | 3 alarms | $0 |
| **Total** | | | **$0** |

## Security Considerations

### IAM Least Privilege

- Lambda role: Only SQS send/receive and DynamoDB read
- Worker role: Only SQS receive/send and DynamoDB read/write
- No wildcard permissions

### Encryption

- SQS: Encrypted at rest with AWS-managed KMS
- DynamoDB: Encrypted at rest with AWS-managed KMS
- API Gateway: HTTPS only

### Secrets Management

- API keys: Stored in AWS Secrets Manager
- Database credentials: Stored in AWS Secrets Manager
- GitHub Actions: Uses OIDC for credential-less authentication

## Rollback Procedure

### Rollback to Previous Version

```bash
# 1. Identify previous tag
git tag | grep llm-proxy | sort -V | tail -5

# 2. Create rollback tag
git tag llm-proxy-v1.0.0-rollback

# 3. Push tag
git push origin llm-proxy-v1.0.0-rollback

# 4. Create GitHub release with rollback tag
# (via GitHub UI)
```

### Manual Rollback

```bash
# 1. Get previous image digest
aws ecr describe-images \
  --repository-name llm-proxy-production \
  --query 'imageDetails[*].[imageTags,imageDigest]' \
  --sort-by imageDate

# 2. Update Lambda function
aws lambda update-function-code \
  --function-name llm-proxy-lambda \
  --image-uri <PREVIOUS_IMAGE_DIGEST>
```

## Performance Optimization

### Lambda Optimization

- Memory: 256 MB (adjust based on usage)
- Timeout: 90 seconds (for long-running inference)
- Concurrency: Unlimited (auto-scaling)

### SQS Optimization

- Visibility timeout: 120s (for long-running tasks)
- Message retention: 300s (5 minutes)
- Long polling: 20 seconds (reduces API calls)

### DynamoDB Optimization

- Billing mode: On-demand (auto-scaling)
- TTL: 24 hours (automatic cleanup)
- Partition key: Session ID (even distribution)

## Maintenance

### Regular Tasks

1. **Weekly**: Review CloudWatch logs for errors
2. **Monthly**: Review cost estimates and usage
3. **Quarterly**: Update dependencies and security patches
4. **Annually**: Review and update infrastructure

### Cleanup

```bash
# Remove old images from ECR
aws ecr describe-images \
  --repository-name llm-proxy-production \
  --query 'imageDetails[?imagePushedAt<`2024-01-01`].[imageDigest]' \
  --output text | \
  xargs -I {} aws ecr batch-delete-image \
    --repository-name llm-proxy-production \
    --image-ids imageDigest={}
```

## References

- [Deployment Guide](.github/LLMPROXY_DEPLOYMENT_GUIDE.md)
- [Design Document](.kiro/specs/aws-native-llm-proxy/design.md)
- [Requirements](.kiro/specs/aws-native-llm-proxy/requirements.md)
- [AWS SST Documentation](https://docs.sst.dev/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

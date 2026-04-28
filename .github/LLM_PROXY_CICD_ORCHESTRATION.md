# LLM Proxy CI/CD Orchestration Guide

## Overview

The LLM Proxy CI/CD pipeline is a fully automated, multi-stage deployment system that provisions infrastructure and deploys the LLM Proxy service on release detection. The pipeline is triggered by GitHub tags matching the pattern `llm-proxy-v*.*.*`.

## Pipeline Architecture

```
GitHub Tag (llm-proxy-v*.*.*)
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Setup CI/CD Pipeline (setup-llm-proxy-cicd.yml)             │
├─────────────────────────────────────────────────────────────┤
│ 1. Check Infrastructure Status                              │
│    - Verify SQS queues exist                                │
│    - Verify DynamoDB table exists                           │
│    - Verify Lambda function exists                          │
│    - Verify API Gateway exists                              │
│                                                              │
│ 2. Setup AWS Base Layer (if needed)                         │
│    - Create S3 bucket for SST state                         │
│    - Create DynamoDB table for SST state                    │
│    - Create ECR repository                                  │
│    - Create SNS topic for alerts                            │
│    - Create CloudWatch log group                            │
│                                                              │
│ 3. Setup SST Infrastructure (if needed)                     │
│    - Deploy SQS queues (request, response, DLQ)             │
│    - Deploy DynamoDB table (llm-proxy-state)                │
│    - Deploy Lambda function (llm-proxy-lambda)              │
│    - Deploy API Gateway (llm-proxy-api)                     │
│    - Deploy IAM roles (lambda-role, worker-user)            │
│    - Deploy SNS topic (llm-proxy-alerts)                    │
│    - Deploy CloudWatch alarms (3 configured)                │
│                                                              │
│ 4. Validate Infrastructure                                  │
│    - Verify all resources are created and active            │
│    - Check resource configurations                          │
│    - Validate IAM permissions                               │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ Release Pipeline (llm-proxy-release.yml)                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Detect Changes                                           │
│    - Identify source code changes                           │
│    - Identify runtime/infrastructure changes                │
│    - Generate source fingerprint                            │
│                                                              │
│ 2. Validate Code Quality                                    │
│    - Run linting checks                                     │
│    - Run unit tests                                         │
│    - Build TypeScript                                       │
│                                                              │
│ 3. Build Docker Image                                       │
│    - Build multi-stage Docker image                         │
│    - Push to ECR (AWS)                                      │
│    - Push to Docker Hub                                     │
│    - Tag with commit SHA and release tag                    │
│                                                              │
│ 4. Deploy Infrastructure                                    │
│    - Deploy with SST to production stage                    │
│    - Update Lambda function code                            │
│    - Update API Gateway routes                              │
│    - Update CloudWatch alarms                               │
│                                                              │
│ 5. Run Smoke Tests                                          │
│    - Test /health endpoint                                  │
│    - Test /v1/models endpoint                               │
│    - Verify API Gateway connectivity                        │
│                                                              │
│ 6. Generate Release Summary                                 │
│    - Document deployment details                            │
│    - List available endpoints                               │
│    - Provide troubleshooting links                          │
└─────────────────────────────────────────────────────────────┘
    ↓
✅ Deployment Complete
```

## Workflows

### 1. Setup CI/CD Pipeline (`setup-llm-proxy-cicd.yml`)

**Trigger:** 
- Manual: `workflow_dispatch` with optional `force_setup` flag
- Automatic: On first release tag if infrastructure doesn't exist

**Jobs:**

#### `check-infrastructure-status`
Checks if infrastructure already exists to avoid redundant setup.

**Outputs:**
- `infrastructure_exists`: Boolean indicating if all resources exist
- `needs_setup`: Boolean indicating if setup is required

#### `setup-aws-base-layer`
Creates foundational AWS resources needed for SST deployment.

**Resources Created:**
- S3 bucket for SST state (with versioning and encryption)
- DynamoDB table for SST state (on-demand billing)
- ECR repository (with lifecycle policy to keep last 10 images)
- SNS topic for alerts
- CloudWatch log group (30-day retention)

#### `setup-sst-infrastructure`
Deploys the full LLM Proxy infrastructure using SST.

**Resources Deployed:**
- SQS Queues:
  - `llm-proxy-request-queue` (120s visibility, 300s retention)
  - `llm-proxy-response-queue` (30s visibility, 300s retention)
  - `llm-proxy-dlq` (14-day retention, redrive policy)
- DynamoDB Table:
  - `llm-proxy-state` (on-demand billing, TTL enabled)
- Lambda Function:
  - `llm-proxy-lambda` (256MB, 90s timeout, Node.js 20.x)
- API Gateway:
  - `llm-proxy-api` (HTTP API with routes: /v1/*, /health, /admin/*, /mcp/*)
- IAM Roles:
  - `llm-proxy-lambda-role` (SQS, DynamoDB permissions)
  - `llm-proxy-worker-user` (Colab worker permissions)
- SNS Topic:
  - `llm-proxy-alerts` (email notifications)
- CloudWatch Alarms:
  - Request queue depth > 10 for 5 minutes
  - DLQ messages visible > 0
  - Heartbeat age > 120 seconds

#### `validate-infrastructure`
Validates all deployed resources are active and properly configured.

**Validations:**
- SQS queues exist and have correct attributes
- DynamoDB table is ACTIVE with TTL enabled
- Lambda function is Active with correct configuration
- API Gateway exists with correct routes
- IAM roles exist with correct permissions
- SNS topic exists
- CloudWatch alarms are configured

### 2. Release Pipeline (`llm-proxy-release.yml`)

**Trigger:**
- Push: On tags matching `llm-proxy-v*.*.*`
- Manual: `workflow_dispatch` with tag and optional `dry_run` flag

**Jobs:**

#### `setup-cicd`
Verifies infrastructure is ready before proceeding with deployment.

**Checks:**
- SQS queues exist
- DynamoDB table exists
- Lambda function exists

#### `detect-changes`
Identifies what changed in the commit to determine deployment scope.

**Detects:**
- Source code changes (src/, package.json, tsconfig.json)
- Runtime changes (infra/, sst.config.ts)
- Generates source fingerprint for tracking

#### `validate-code`
Runs code quality checks (only if source changed).

**Steps:**
- Lint TypeScript
- Run unit tests
- Build TypeScript

#### `build-docker-image`
Builds and pushes Docker image to ECR and Docker Hub.

**Steps:**
- Resolve image metadata (ECR URI, Docker Hub image, tags)
- Ensure ECR repository exists
- Login to ECR and Docker Hub
- Build multi-stage Docker image
- Push with tags: `sha-{commit}` and `{release-tag}`
- Cache layers for faster builds

**Outputs:**
- `image_uri`: Full ECR image URI with digest
- `image_digest`: Image digest hash
- `source_tag`: Release tag

#### `deploy-infrastructure`
Deploys infrastructure updates using SST.

**Steps:**
- Install dependencies
- Configure AWS credentials
- Deploy with SST to production stage
- Updates Lambda function code with new image
- Updates API Gateway routes
- Updates CloudWatch alarms

#### `run-smoke-tests`
Validates deployment with basic health checks.

**Tests:**
- Health endpoint: `GET /health`
- Models endpoint: `GET /v1/models`
- API Gateway connectivity check

#### `generate-release-summary`
Creates GitHub Actions summary with deployment details.

**Summary Includes:**
- Release tag and commit
- Docker image URI and digest
- Deployment status
- Available service endpoints
- Documentation links

## Environment Variables

### Required (set in GitHub repository settings)

```bash
AWS_REGION              # AWS region (default: us-east-2)
LLM_PROXY_DOMAIN        # Domain for LLM Proxy (default: llm-proxy.cig.technology)
LLM_PROXY_IMAGE_REPOSITORY  # ECR repository name (default: llm-proxy-production)
DOCKERHUB_USERNAME      # Docker Hub username (default: cigtechnology)
DOCKERHUB_LLM_PROXY_IMAGE  # Docker Hub image name (default: llm-proxy)
INFRA_APP_NAME          # SST app name (default: llm-proxy)
```

### Required Secrets (set in GitHub repository settings)

```bash
AWS_ROLE_TO_ASSUME      # AWS IAM role ARN for GitHub Actions
DOCKERHUB_TOKEN         # Docker Hub personal access token
```

## Triggering Deployments

### Automatic Deployment (Recommended)

Create a GitHub release with a tag matching `llm-proxy-v*.*.*`:

```bash
# Create and push tag
git tag llm-proxy-v1.0.0
git push origin llm-proxy-v1.0.0

# Or create release via GitHub UI
# 1. Go to Releases
# 2. Click "Create a new release"
# 3. Tag: llm-proxy-v1.0.0
# 4. Title: LLM Proxy v1.0.0
# 5. Click "Publish release"
```

### Manual Deployment

Trigger via GitHub Actions UI:

1. Go to **Actions** tab
2. Select **LLM Proxy Release Pipeline**
3. Click **Run workflow**
4. Enter tag (e.g., `llm-proxy-v1.0.0`)
5. Optionally check **Validate without deploying** for dry run
6. Click **Run workflow**

### Manual Setup

Trigger infrastructure setup via GitHub Actions UI:

1. Go to **Actions** tab
2. Select **Setup LLM Proxy CI/CD Pipeline**
3. Click **Run workflow**
4. Optionally check **Force infrastructure setup**
5. Click **Run workflow**

## Monitoring Deployments

### GitHub Actions

1. Go to **Actions** tab
2. Select the workflow run
3. View real-time logs for each job
4. Check job summaries for deployment details

### AWS Console

Monitor resources in AWS:

- **SQS**: View queue metrics and messages
- **DynamoDB**: Check table metrics and items
- **Lambda**: Monitor function invocations and errors
- **API Gateway**: Check request metrics
- **CloudWatch**: View logs and alarms
- **SNS**: Check alert subscriptions

### CloudWatch Logs

View Lambda logs:

```bash
aws logs tail /aws/lambda/llm-proxy-lambda --follow
```

## Troubleshooting

### Deployment Fails at Infrastructure Check

**Problem:** Setup job reports infrastructure doesn't exist

**Solution:**
1. Manually trigger setup workflow: **Setup LLM Proxy CI/CD Pipeline**
2. Check AWS console for resource creation errors
3. Verify IAM role has required permissions

### Docker Build Fails

**Problem:** Build job fails with Docker build error

**Solution:**
1. Check Dockerfile syntax: `docker build -f packages/llm-proxy/Dockerfile .`
2. Verify all dependencies are in package.json
3. Check Docker Hub credentials in GitHub secrets

### Smoke Tests Fail

**Problem:** Health check returns 503 or timeout

**Solution:**
1. Wait 60 seconds for Lambda to initialize
2. Check CloudWatch logs for Lambda errors
3. Verify API Gateway is properly configured
4. Check SQS queue for stuck messages

### Infrastructure Validation Fails

**Problem:** Validation job reports missing resources

**Solution:**
1. Check SST deployment logs for errors
2. Verify AWS credentials and permissions
3. Check CloudFormation stack in AWS console
4. Review SST configuration in `packages/llm-proxy/sst.config.ts`

## Cost Estimation

All resources are within AWS free tier:

- **SQS**: 1M requests/month free
- **DynamoDB**: 25GB storage, 25 write/read capacity units free
- **Lambda**: 1M requests/month, 400,000 GB-seconds/month free
- **API Gateway**: 1M requests/month free
- **CloudWatch**: 10 alarms free
- **SNS**: 1,000 email notifications/month free

**Total Monthly Cost: $0** (within free tier)

## Security Considerations

### IAM Permissions

The GitHub Actions role requires:
- SQS: CreateQueue, GetQueueUrl, SendMessage, ReceiveMessage, DeleteMessage
- DynamoDB: CreateTable, DescribeTable, PutItem, GetItem, UpdateItem
- Lambda: CreateFunction, UpdateFunctionCode, GetFunction
- API Gateway: CreateApi, CreateRoute, CreateIntegration
- ECR: CreateRepository, PutImage, GetDownloadUrlForLayer
- CloudWatch: PutMetricAlarm, DescribeAlarms
- SNS: CreateTopic, Publish
- IAM: CreateRole, PutRolePolicy, CreateUser, PutUserPolicy

### Secrets Management

- Docker Hub token: Use personal access token with minimal scopes
- AWS credentials: Use temporary credentials via OIDC (recommended)
- API keys: Store in AWS Secrets Manager, not GitHub secrets

### Network Security

- API Gateway: HTTPS only
- SQS: Encryption at rest with AWS-managed KMS
- DynamoDB: Encryption at rest enabled
- Lambda: VPC optional (not required for this setup)

## Next Steps

1. **Configure GitHub Secrets**
   - Set `AWS_ROLE_TO_ASSUME` with your IAM role ARN
   - Set `DOCKERHUB_TOKEN` with your Docker Hub token

2. **Configure GitHub Variables**
   - Set `AWS_REGION` to your preferred region
   - Set `LLM_PROXY_DOMAIN` to your domain
   - Set other variables as needed

3. **Create First Release**
   - Create tag: `git tag llm-proxy-v0.1.0`
   - Push tag: `git push origin llm-proxy-v0.1.0`
   - Monitor deployment in GitHub Actions

4. **Verify Deployment**
   - Check health endpoint: `curl https://llm-proxy.cig.technology/health`
   - Check models endpoint: `curl https://llm-proxy.cig.technology/v1/models`
   - Review CloudWatch logs

## Documentation

- [Deployment Guide](./LLMPROXY_DEPLOYMENT_GUIDE.md)
- [CI/CD README](./LLM_PROXY_CICD_README.md)
- [Release Flow](./LLM_PROXY_RELEASE_FLOW.md)
- [GitHub Setup](./LLM_PROXY_GITHUB_SETUP.md)
- [Pipeline Summary](./LLM_PROXY_PIPELINE_SUMMARY.md)

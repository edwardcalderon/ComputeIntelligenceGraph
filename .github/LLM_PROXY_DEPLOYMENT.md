# LLM Proxy AWS-Native Pipeline Deployment

## Overview

The LLM Proxy release pipeline runs entirely on AWS using CodePipeline and CodeBuild with secure GitHub integration via AWS CodeStar Connections.

**Architecture:**
```
GitHub Repository → CodeStar Connection → CodePipeline
                                              ├── Source (GitHub)
                                              ├── Validate (CodeBuild)
                                              ├── Build (CodeBuild)
                                              └── Deploy (CodeBuild)
                                                   ↓
                                          AWS Infrastructure
                                          ├── Lambda
                                          ├── API Gateway
                                          ├── SQS Queues
                                          ├── DynamoDB
                                          └── CloudWatch
```

## Quick Start

### Prerequisites

- AWS credentials in `.env` (already configured)
- Node.js 22+
- pnpm 9.0.0+
- AWS CLI

### Deployment

```bash
# 1. Build the package
pnpm --filter @llm-proxy/app build

# 2. Preview infrastructure changes
pnpm --filter @llm-proxy/app diff:prod

# 3. Deploy to AWS
pnpm --filter @llm-proxy/app deploy:prod
```

**Deployment time:** 8-15 minutes

## Infrastructure Components

### AWS Resources Created

| Resource | Name | Purpose |
|----------|------|---------|
| CodePipeline | `llm-proxy-production-pipeline` | Orchestrates the release process |
| CodeBuild | `llm-proxy-production-validate` | Lint, test, build validation |
| CodeBuild | `llm-proxy-production-build-docker` | Build and push Docker image to ECR |
| CodeBuild | `llm-proxy-production-deploy` | Deploy via SST |
| IAM Role | `llm-proxy-production-pipeline-role` | CodePipeline permissions |
| IAM Role | `llm-proxy-production-build-role` | CodeBuild permissions |
| S3 Bucket | `llm-proxy-production-pipeline-artifacts-*` | Pipeline artifacts |
| Lambda | `llm-proxy-production` | LLM Proxy compute |
| API Gateway | `llm-proxy-production-api` | HTTP API endpoints |
| SQS Queue | `llm-proxy-production-request-queue` | Request queue |
| SQS Queue | `llm-proxy-production-response-queue` | Response queue |
| SQS Queue | `llm-proxy-production-dlq` | Dead letter queue |
| DynamoDB | `llm-proxy-production-state` | State store |
| SNS Topic | `llm-proxy-production-alerts` | Alert notifications |
| CloudWatch | Alarms (3) | Queue depth, DLQ, Lambda errors |

### Deployment Flow

1. **Source Stage** - CodePipeline pulls code from GitHub via CodeStar Connection
2. **Validate Stage** - CodeBuild runs:
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @llm-proxy/app lint
   pnpm --filter @llm-proxy/app test
   pnpm --filter @llm-proxy/app build
   ```
3. **Build Stage** - CodeBuild runs:
   ```bash
   docker build -f packages/llm-proxy/Dockerfile -t <ecr-uri>:sha-<hash> .
   docker push <ecr-uri>:sha-<hash>
   docker push <ecr-uri>:latest
   ```
4. **Deploy Stage** - CodeBuild runs:
   ```bash
   export LLM_PROXY_IMAGE_URI=<image-uri>
   pnpm --filter @llm-proxy/app deploy:production
   ```

## Configuration

### Environment Variables

The deployment uses these environment variables from `.env`:

```bash
AWS_REGION=us-east-2
AWS_ACCOUNT_ID=520900722378
AWS_KEY_ID=<from .env>
AWS_SECRET_ACCESS_KEY=<from .env>
```

### Pipeline Configuration

Set these before deployment:

```bash
export INFRA_CREATE_PIPELINES=true
export INFRA_PIPELINE_REPO_NAME=compute-intelligence-graph
export INFRA_PIPELINE_REPO_OWNER=cigtechnology
export INFRA_PIPELINE_BRANCH_PROD=main
export INFRA_CODESTAR_CONNECTION_ARN=arn:aws:codestar-connections:us-east-2:520900722378:connection/<connection-id>
```

### CodeStar Connection Setup

If you don't have a CodeStar connection yet:

```bash
# Create connection
aws codestar-connections create-connection \
  --provider-type GitHub \
  --connection-name llm-proxy-github \
  --region us-east-2

# Authorize in AWS Console:
# 1. Go to Developer Tools → Connections
# 2. Find llm-proxy-github
# 3. Click "Update pending connection"
# 4. Click "Connect to GitHub"
# 5. Authorize AWS CodeStar
# 6. Wait for status to change to "Available"

# Get the ARN
aws codestar-connections list-connections \
  --region us-east-2 \
  --query 'Connections[?ConnectionName==`llm-proxy-github`].ConnectionArn' \
  --output text
```

## Monitoring

### Check Pipeline Status

```bash
aws codepipeline get-pipeline-state \
  --name llm-proxy-production-pipeline \
  --region us-east-2
```

### View Build Logs

```bash
# Validate stage
aws logs tail /aws/codebuild/llm-proxy-production-validate --follow

# Build stage
aws logs tail /aws/codebuild/llm-proxy-production-build-docker --follow

# Deploy stage
aws logs tail /aws/codebuild/llm-proxy-production-deploy --follow
```

### Manually Trigger Pipeline

```bash
aws codepipeline start-pipeline-execution \
  --name llm-proxy-production-pipeline \
  --region us-east-2
```

## Troubleshooting

### Pipeline Fails at Source Stage

**Error:** "Connection not found" or "Connection not available"

**Solution:**
1. Verify connection ARN is correct
2. Check connection status: `aws codestar-connections get-connection --connection-arn <arn>`
3. Ensure connection status is "AVAILABLE"

### Pipeline Fails at Validate Stage

**Error:** Code validation failed

**Solution:**
1. Check CodeBuild logs
2. Fix code issues locally
3. Push fix to GitHub
4. Pipeline will automatically retry

### Pipeline Fails at Build Stage

**Error:** Docker build failed

**Solution:**
1. Check CodeBuild logs
2. Verify ECR repository exists
3. Test build locally: `docker build -f packages/llm-proxy/Dockerfile .`
4. Fix Dockerfile if needed

### Pipeline Fails at Deploy Stage

**Error:** SST deploy failed

**Solution:**
1. Check CodeBuild logs
2. Verify environment variables are set
3. Check CloudFormation events
4. Review SST documentation

## Rollback

### Option 1: Revert Code

```bash
git revert <commit-hash>
git push origin main
# Pipeline automatically runs with reverted code
```

### Option 2: Redeploy Previous Image

```bash
# Get previous image URI
aws ecr describe-images \
  --repository-name llm-proxy-production \
  --region us-east-2 \
  --query 'imageDetails[*].[imageTags,imagePushedAt]' \
  --sort-by imagePushedAt

# Deploy with previous image
export LLM_PROXY_IMAGE_URI=<previous-image-uri>
pnpm --filter @llm-proxy/app deploy:prod
```

### Option 3: Use SST Rollback

```bash
pnpm --filter @llm-proxy/app sst rollback --stage production
```

## Cost Estimation

| Service | Cost |
|---------|------|
| CodePipeline | $1/month |
| CodeBuild | $5-10/month |
| S3 | $1-2/month |
| Other services | $5-10/month |
| **Total** | **~$12-23/month** |

## Security

### CodeStar Connections Benefits

- ✅ No personal access tokens to manage
- ✅ OAuth-based authentication
- ✅ Easy to revoke access
- ✅ Full CloudTrail audit trail
- ✅ Repository-level access control

### IAM Permissions

The build role has permissions for:
- CloudFormation (SST deploy)
- IAM (role management)
- SQS, DynamoDB, Lambda, API Gateway (infrastructure)
- ECR (Docker images)
- CloudWatch (logging)

## Files

### Infrastructure Code

- `packages/llm-proxy/infra.config.ts` - Infrastructure definition
- `packages/llm-proxy/sst.config.ts` - SST configuration
- `packages/llm-proxy/package.json` - Build and deployment scripts

### Deployment Wrapper

- `packages/llm-proxy/src/deployers/LlmProxyDeployer.ts` - Deployment wrapper
- `packages/llm-proxy/src/deployers/LlmProxyPipelineDeployer.ts` - Pipeline deployer
- `packages/llm-proxy/src/deployers/llmProxyRuntime.ts` - Config resolution

### Documentation

- `.github/LLM_PROXY_DEPLOYMENT.md` - This file (main documentation)
- `.github/LLM_PROXY_DEPLOYMENT_QUICK_REFERENCE.md` - Quick reference guide

## Next Steps

1. Ensure AWS credentials are in `.env`
2. Create/verify CodeStar connection
3. Set pipeline configuration environment variables
4. Run deployment command
5. Monitor pipeline in AWS Console
6. Verify endpoints are responding

## Support

For detailed information:
- AWS CodePipeline: https://docs.aws.amazon.com/codepipeline/
- AWS CodeBuild: https://docs.aws.amazon.com/codebuild/
- AWS CodeStar Connections: https://docs.aws.amazon.com/dtconsole/latest/userguide/connections.html
- SST: https://docs.sst.dev/

# LLM Proxy CI/CD Pipeline - Complete Index

## 📋 Overview

The LLM Proxy CI/CD pipeline is a fully automated, production-ready deployment system that:
- ✅ Automatically provisions AWS infrastructure on first release
- ✅ Builds and deploys on every release tag (`llm-proxy-v*.*.*`)
- ✅ Validates code quality and infrastructure
- ✅ Runs smoke tests to verify deployment
- ✅ Maintains zero cost (all within AWS free tier)

## 🚀 Quick Start (5 minutes)

1. **Configure GitHub Secrets** (2 min)
   - `AWS_ROLE_TO_ASSUME` - Your AWS IAM role ARN
   - `DOCKERHUB_TOKEN` - Your Docker Hub token

2. **Create Release Tag** (1 min)
   ```bash
   git tag llm-proxy-v0.1.0
   git push origin llm-proxy-v0.1.0
   ```

3. **Monitor Deployment** (2 min)
   - Go to **Actions** tab
   - Watch workflows complete
   - Verify endpoints are responding

👉 **[Full Quick Start Guide](./LLM_PROXY_QUICK_START.md)**

## 📚 Documentation

### For Getting Started
- **[Quick Start](./LLM_PROXY_QUICK_START.md)** - 5-minute setup guide
- **[Setup Summary](./LLM_PROXY_CICD_SETUP_SUMMARY.md)** - What was created and how to use it

### For Understanding the Pipeline
- **[Orchestration Guide](./LLM_PROXY_CICD_ORCHESTRATION.md)** - Complete technical documentation
- **[CI/CD README](./LLM_PROXY_CICD_README.md)** - Architecture and workflows
- **[Pipeline Summary](./LLM_PROXY_PIPELINE_SUMMARY.md)** - Overview and getting started

### For Deployment & Operations
- **[Deployment Guide](./LLMPROXY_DEPLOYMENT_GUIDE.md)** - User-facing deployment guide
- **[Release Flow](./LLM_PROXY_RELEASE_FLOW.md)** - Release procedures and troubleshooting
- **[GitHub Setup](./LLM_PROXY_GITHUB_SETUP.md)** - GitHub Actions configuration

## 🔄 Workflows

### Setup Workflow
**File:** `.github/workflows/setup-llm-proxy-cicd.yml`

**Purpose:** Provisions AWS infrastructure (runs once or on manual trigger)

**Jobs:**
1. Check infrastructure status
2. Setup AWS base layer (S3, DynamoDB, ECR, SNS, CloudWatch)
3. Deploy SST infrastructure (SQS, Lambda, API Gateway, IAM, alarms)
4. Validate all resources
5. Generate setup summary

**Triggers:**
- Manual: `workflow_dispatch` with optional `force_setup` flag
- Automatic: On first release tag if infrastructure missing

**Duration:** 10-15 minutes

### Release Workflow
**File:** `.github/workflows/llm-proxy-release.yml`

**Purpose:** Builds and deploys on every release (runs on each tag)

**Jobs:**
1. Setup CI/CD (verify infrastructure ready)
2. Detect changes (identify what changed)
3. Validate code (lint, test, build)
4. Build Docker image (push to ECR and Docker Hub)
5. Deploy infrastructure (update with SST)
6. Run smoke tests (verify deployment)
7. Generate release summary

**Triggers:**
- Push: Tags matching `llm-proxy-v*.*.*`
- Manual: `workflow_dispatch` with tag and optional `dry_run`

**Duration:** 15-20 minutes

### Legacy Workflows (Still Functional)
- `.github/workflows/deploy-llm-proxy.yml` - Original deployment workflow
- `.github/workflows/bootstrap-llm-proxy.yml` - Original bootstrap workflow

## 🏗️ Infrastructure

### AWS Services Provisioned
- **SQS**: 3 queues (request, response, DLQ)
- **DynamoDB**: 1 table (llm-proxy-state)
- **Lambda**: 1 function (llm-proxy-lambda, 256MB, 90s timeout)
- **API Gateway**: 1 HTTP API (llm-proxy-api)
- **IAM**: 2 roles (lambda-role, worker-user)
- **SNS**: 1 topic (llm-proxy-alerts)
- **CloudWatch**: 3 alarms + 1 log group
- **ECR**: 1 repository (llm-proxy-production)
- **S3**: 1 bucket (SST state)

### Resource Naming Convention
All resources prefixed with `llm-proxy-`:
```
llm-proxy-request-queue
llm-proxy-response-queue
llm-proxy-dlq
llm-proxy-state
llm-proxy-lambda
llm-proxy-api
llm-proxy-lambda-role
llm-proxy-worker-user
llm-proxy-alerts
llm-proxy-production (ECR)
```

### Cost
**Total: $0/month** (all within AWS free tier)

## 🔐 Configuration

### GitHub Secrets (Required)
```
AWS_ROLE_TO_ASSUME = arn:aws:iam::ACCOUNT_ID:role/github-actions-role
DOCKERHUB_TOKEN = your-docker-hub-token
```

### GitHub Variables (Optional - Uses Defaults)
```
AWS_REGION = us-east-2
LLM_PROXY_DOMAIN = llm-proxy.cig.technology
LLM_PROXY_IMAGE_REPOSITORY = llm-proxy-production
DOCKERHUB_USERNAME = cigtechnology
DOCKERHUB_LLM_PROXY_IMAGE = llm-proxy
INFRA_APP_NAME = llm-proxy
```

## 📊 Pipeline Flow

```
GitHub Tag (llm-proxy-v*.*.*)
    ↓
┌─────────────────────────────────────┐
│ Setup CI/CD (if infrastructure      │
│ doesn't exist)                      │
├─────────────────────────────────────┤
│ • Check infrastructure status       │
│ • Create AWS base layer             │
│ • Deploy SST infrastructure         │
│ • Validate resources                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Release Pipeline                    │
├─────────────────────────────────────┤
│ • Detect changes                    │
│ • Validate code (lint, test, build) │
│ • Build Docker image                │
│ • Deploy infrastructure             │
│ • Run smoke tests                   │
│ • Generate summary                  │
└─────────────────────────────────────┘
    ↓
✅ Deployment Complete
```

## 🎯 Available Endpoints

After deployment, these endpoints are available:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/v1/models` | GET | List available models |
| `/v1/chat/completions` | POST | Chat completions |
| `/v1/completions` | POST | Text completions |
| `/admin/sessions` | GET | List worker sessions |
| `/mcp/tools` | GET | List MCP tools |

**Base URL:** `https://llm-proxy.cig.technology`

## 🔍 Monitoring

### GitHub Actions
1. Go to **Actions** tab
2. Select workflow run
3. View real-time logs
4. Check job summaries

### AWS Console
- **SQS**: Queue metrics and messages
- **DynamoDB**: Table metrics and items
- **Lambda**: Function invocations and errors
- **API Gateway**: Request metrics
- **CloudWatch**: Logs and alarms

### CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/llm-proxy-lambda --follow

# View specific time range
aws logs filter-log-events \
  --log-group-name /aws/lambda/llm-proxy-lambda \
  --start-time $(date -d '1 hour ago' +%s)000
```

## 🚨 Troubleshooting

### Setup Fails
- Check AWS credentials in GitHub secrets
- Verify IAM role has required permissions
- Check CloudFormation stack in AWS console

### Deployment Fails
- Check Docker build logs
- Verify Docker Hub credentials
- Check Lambda function logs in CloudWatch

### Smoke Tests Fail
- Wait 60 seconds for Lambda to initialize
- Check API Gateway configuration
- Verify SQS queues are accessible

👉 **[Full Troubleshooting Guide](./LLM_PROXY_RELEASE_FLOW.md#troubleshooting)**

## 📝 Common Tasks

### Deploy New Version
```bash
git tag llm-proxy-v1.0.1
git push origin llm-proxy-v1.0.1
```

### Force Infrastructure Setup
1. Go to **Actions**
2. Select **Setup LLM Proxy CI/CD Pipeline**
3. Click **Run workflow**
4. Check **Force infrastructure setup**
5. Click **Run workflow**

### Dry Run Deployment
1. Go to **Actions**
2. Select **LLM Proxy Release Pipeline**
3. Click **Run workflow**
4. Enter tag
5. Check **Validate without deploying**
6. Click **Run workflow**

### View Deployment Logs
1. Go to **Actions**
2. Select workflow run
3. Click job name
4. View real-time logs

## 📦 Files Created

### Workflows
```
.github/workflows/
├── setup-llm-proxy-cicd.yml      (NEW - Infrastructure setup)
├── llm-proxy-release.yml         (NEW - Release pipeline)
├── deploy-llm-proxy.yml          (EXISTING - Still functional)
└── bootstrap-llm-proxy.yml       (EXISTING - Still functional)
```

### Documentation
```
.github/
├── LLM_PROXY_CICD_INDEX.md              (NEW - This file)
├── LLM_PROXY_QUICK_START.md             (NEW - 5-minute setup)
├── LLM_PROXY_CICD_SETUP_SUMMARY.md      (NEW - What was created)
├── LLM_PROXY_CICD_ORCHESTRATION.md      (NEW - Full technical guide)
├── LLMPROXY_DEPLOYMENT_GUIDE.md         (EXISTING)
├── LLM_PROXY_CICD_README.md             (EXISTING)
├── LLM_PROXY_RELEASE_FLOW.md            (EXISTING)
├── LLM_PROXY_GITHUB_SETUP.md            (EXISTING)
└── LLM_PROXY_PIPELINE_SUMMARY.md        (EXISTING)
```

## 🎓 Learning Path

1. **Start Here**: [Quick Start](./LLM_PROXY_QUICK_START.md) (5 min)
2. **Understand**: [Setup Summary](./LLM_PROXY_CICD_SETUP_SUMMARY.md) (10 min)
3. **Deep Dive**: [Orchestration Guide](./LLM_PROXY_CICD_ORCHESTRATION.md) (20 min)
4. **Reference**: [CI/CD README](./LLM_PROXY_CICD_README.md) (as needed)
5. **Troubleshoot**: [Release Flow](./LLM_PROXY_RELEASE_FLOW.md) (as needed)

## ✅ Next Steps

1. **Configure GitHub** (5 min)
   - Add secrets: `AWS_ROLE_TO_ASSUME`, `DOCKERHUB_TOKEN`
   - Add variables (optional, uses defaults)

2. **Create First Release** (2 min)
   ```bash
   git tag llm-proxy-v0.1.0
   git push origin llm-proxy-v0.1.0
   ```

3. **Monitor Deployment** (ongoing)
   - Go to **Actions** tab
   - Watch workflows complete

4. **Verify Deployment** (1 min)
   ```bash
   curl https://llm-proxy.cig.technology/health
   curl https://llm-proxy.cig.technology/v1/models
   ```

5. **Configure Monitoring** (optional)
   - Set up SNS email alerts
   - Create CloudWatch dashboard
   - Configure log aggregation

## 📞 Support

For issues or questions:
1. Check [Quick Start](./LLM_PROXY_QUICK_START.md) troubleshooting
2. Review [Orchestration Guide](./LLM_PROXY_CICD_ORCHESTRATION.md)
3. Check GitHub Actions logs
4. Review AWS CloudWatch logs
5. Consult AWS console for resource status

## 📄 License

This CI/CD pipeline is part of the Compute Intelligence Graph project.

---

**Last Updated:** April 28, 2026
**Version:** 1.0.0
**Status:** Production Ready ✅

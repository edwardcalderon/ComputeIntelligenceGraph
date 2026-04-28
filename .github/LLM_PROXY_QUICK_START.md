# LLM Proxy CI/CD Quick Start

## 5-Minute Setup

### 1. Configure GitHub Secrets (2 min)

Go to **Settings → Secrets and variables → Actions**

Add these secrets:
```
AWS_ROLE_TO_ASSUME = arn:aws:iam::ACCOUNT_ID:role/github-actions-role
DOCKERHUB_TOKEN = your-docker-hub-token
```

### 2. Configure GitHub Variables (1 min)

Go to **Settings → Secrets and variables → Variables**

Add these variables (or use defaults):
```
AWS_REGION = us-east-2
LLM_PROXY_DOMAIN = llm-proxy.cig.technology
LLM_PROXY_IMAGE_REPOSITORY = llm-proxy-production
DOCKERHUB_USERNAME = cigtechnology
DOCKERHUB_LLM_PROXY_IMAGE = llm-proxy
INFRA_APP_NAME = llm-proxy
```

### 3. Create First Release (2 min)

```bash
# Create tag
git tag llm-proxy-v0.1.0

# Push tag (triggers setup + deployment)
git push origin llm-proxy-v0.1.0
```

### 4. Monitor Deployment (ongoing)

Go to **Actions** tab and watch the workflows:
1. **Setup LLM Proxy CI/CD Pipeline** - Provisions infrastructure
2. **LLM Proxy Release Pipeline** - Builds and deploys

## Workflow Triggers

### Automatic (Recommended)
```bash
git tag llm-proxy-v1.0.0
git push origin llm-proxy-v1.0.0
```

### Manual via GitHub UI
1. Go to **Actions**
2. Select workflow
3. Click **Run workflow**
4. Enter parameters
5. Click **Run workflow**

## Verify Deployment

Once deployment completes:

```bash
# Check health
curl https://llm-proxy.cig.technology/health

# Check models
curl https://llm-proxy.cig.technology/v1/models

# Check admin
curl https://llm-proxy.cig.technology/admin/sessions
```

## Available Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/v1/models` | GET | List available models |
| `/v1/chat/completions` | POST | Chat completions |
| `/v1/completions` | POST | Text completions |
| `/admin/sessions` | GET | List worker sessions |
| `/mcp/tools` | GET | List MCP tools |

## Troubleshooting

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

## Next Steps

1. **Configure Monitoring**
   - Set up SNS email alerts
   - Configure CloudWatch dashboards
   - Set up log aggregation

2. **Configure Domain**
   - Update Route 53 DNS records
   - Configure SSL certificate
   - Set up CDN if needed

3. **Deploy Colab Worker**
   - Create Google Colab notebook
   - Configure AWS credentials
   - Start worker polling

4. **Test Integration**
   - Send test requests to API
   - Verify responses from Colab worker
   - Monitor CloudWatch logs

## Documentation

- [Full Orchestration Guide](./LLM_PROXY_CICD_ORCHESTRATION.md)
- [Deployment Guide](./LLMPROXY_DEPLOYMENT_GUIDE.md)
- [CI/CD README](./LLM_PROXY_CICD_README.md)
- [Release Flow](./LLM_PROXY_RELEASE_FLOW.md)
- [GitHub Setup](./LLM_PROXY_GITHUB_SETUP.md)

## Support

For issues or questions:
1. Check CloudWatch logs: `/aws/lambda/llm-proxy-lambda`
2. Review GitHub Actions logs
3. Check AWS console for resource status
4. Consult full documentation above

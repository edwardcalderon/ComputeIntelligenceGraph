# LLM Proxy Release Flow

## Quick Start

### 1. Initial Setup (One-time)

```bash
# Bootstrap the infrastructure
1. Go to GitHub Actions
2. Select "Bootstrap LLM Proxy infrastructure"
3. Click "Run workflow"
4. Wait for completion (~10-15 minutes)
```

### 2. Create a Release

```bash
# Create and push a tag
git tag llm-proxy-v1.0.0
git push origin llm-proxy-v1.0.0

# Or via GitHub UI:
1. Go to Releases → Create a new release
2. Select tag: llm-proxy-v1.0.0
3. Add release notes
4. Publish release
```

### 3. Monitor Deployment

```bash
# Watch the workflow
1. Go to Actions → Deploy LLM Proxy
2. Click the running workflow
3. Monitor each step
4. Check the deployment summary
```

## Release Workflow

### Tag Format

```
llm-proxy-v<MAJOR>.<MINOR>.<PATCH>

Examples:
- llm-proxy-v1.0.0
- llm-proxy-v1.0.1
- llm-proxy-v1.1.0
- llm-proxy-v2.0.0
```

### Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Release (llm-proxy-v*.*.*)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Detect Changes                                           │
│    - Check for source code changes                          │
│    - Check for infrastructure changes                       │
│    - Determine if deployment needed                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Validate Code                                            │
│    - Run linting (TypeScript)                               │
│    - Run tests (vitest)                                     │
│    - Build application                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Build Docker Image                                       │
│    - Build image with tag llm-proxy-v1.0.0                  │
│    - Push to ECR (AWS)                                      │
│    - Push to Docker Hub (optional)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Provision Infrastructure                                 │
│    - Deploy SQS queues                                      │
│    - Deploy DynamoDB table                                  │
│    - Deploy Lambda function                                 │
│    - Deploy API Gateway                                     │
│    - Configure IAM roles                                    │
│    - Create SNS topic                                       │
│    - Set up CloudWatch alarms                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Run Smoke Tests                                          │
│    - Test /health endpoint                                  │
│    - Test /v1/models endpoint                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Deployment Complete ✅                                   │
│    - Service available at https://llm-proxy.cig.technology  │
│    - Deployment summary generated                           │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Checklist

### Before Release

- [ ] Code changes are complete and tested locally
- [ ] All tests pass: `pnpm --filter @llm-proxy/app test`
- [ ] Code builds successfully: `pnpm --filter @llm-proxy/app build`
- [ ] Linting passes: `pnpm --filter @llm-proxy/app lint`
- [ ] Git is clean: `git status`
- [ ] Latest changes are committed: `git log --oneline -5`

### Creating Release

- [ ] Determine version number (semantic versioning)
- [ ] Create tag: `git tag llm-proxy-v1.0.0`
- [ ] Push tag: `git push origin llm-proxy-v1.0.0`
- [ ] Create GitHub release with release notes

### During Deployment

- [ ] Monitor GitHub Actions workflow
- [ ] Check each step completes successfully
- [ ] Review deployment summary
- [ ] Verify no errors in logs

### After Deployment

- [ ] Test health endpoint: `curl https://llm-proxy.cig.technology/health`
- [ ] Test models endpoint: `curl https://llm-proxy.cig.technology/v1/models`
- [ ] Check CloudWatch logs for errors
- [ ] Verify CloudWatch alarms are active
- [ ] Document any issues or improvements

## Troubleshooting

### Workflow Fails at Validation

**Problem**: Linting or tests fail

**Solution**:
```bash
# Run locally to debug
pnpm --filter @llm-proxy/app lint
pnpm --filter @llm-proxy/app test

# Fix issues and commit
git add .
git commit -m "fix: resolve linting issues"
git push
```

### Workflow Fails at Build Image

**Problem**: Docker build fails

**Solution**:
```bash
# Build locally to debug
docker build -f packages/llm-proxy/Dockerfile -t llm-proxy:test .

# Check Dockerfile for issues
cat packages/llm-proxy/Dockerfile

# Fix and retry
```

### Workflow Fails at Infrastructure Provisioning

**Problem**: SST deployment fails

**Solution**:
```bash
# Check AWS credentials
aws sts get-caller-identity

# Check IAM permissions
aws iam get-user

# View SST logs
cd packages/llm-proxy
pnpm exec sst diff --stage production

# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name llm-proxy-prod
```

### Smoke Tests Fail

**Problem**: Health check or models endpoint fails

**Solution**:
```bash
# Check Lambda function
aws lambda get-function --function-name llm-proxy-lambda

# View Lambda logs
aws logs tail /aws/lambda/llm-proxy-lambda --follow

# Test Lambda directly
aws lambda invoke \
  --function-name llm-proxy-lambda \
  --payload '{"path":"/health","httpMethod":"GET"}' \
  /tmp/response.json
cat /tmp/response.json
```

## Rollback

### Quick Rollback

```bash
# 1. Identify previous version
git tag | grep llm-proxy | sort -V | tail -5

# 2. Create rollback tag
git tag llm-proxy-v1.0.0-rollback

# 3. Push and create release
git push origin llm-proxy-v1.0.0-rollback
# Create GitHub release with rollback tag
```

### Manual Rollback

```bash
# 1. Get previous image
aws ecr describe-images \
  --repository-name llm-proxy-production \
  --query 'imageDetails[*].[imageTags,imageDigest]' \
  --sort-by imageDate

# 2. Update Lambda
aws lambda update-function-code \
  --function-name llm-proxy-lambda \
  --image-uri <PREVIOUS_IMAGE_DIGEST>
```

## Monitoring

### Real-time Monitoring

```bash
# Watch Lambda logs
aws logs tail /aws/lambda/llm-proxy-lambda --follow

# Watch API Gateway logs
aws logs tail /aws/apigateway/llm-proxy-api --follow

# Watch SQS metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name ApproximateNumberOfMessagesVisible \
  --dimensions Name=QueueName,Value=llm-proxy-request-queue \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### CloudWatch Alarms

```bash
# List alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix llm-proxy

# Get alarm state
aws cloudwatch describe-alarms \
  --alarm-names llm-proxy-alarm-queue-depth
```

### SNS Notifications

```bash
# Subscribe to alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-2:ACCOUNT_ID:llm-proxy-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Performance Metrics

### Key Metrics to Monitor

| Metric | Target | Tool |
|--------|--------|------|
| Lambda Invocations | < 1M/month | CloudWatch |
| Lambda Duration | < 30s avg | CloudWatch |
| Lambda Errors | < 1% | CloudWatch |
| API Gateway Latency | < 1s | CloudWatch |
| SQS Queue Depth | < 10 | CloudWatch |
| DynamoDB Throttling | 0 | CloudWatch |

### Cost Monitoring

```bash
# Estimate monthly costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## Documentation

- **Deployment Guide**: [.github/LLMPROXY_DEPLOYMENT_GUIDE.md](.github/LLMPROXY_DEPLOYMENT_GUIDE.md)
- **CI/CD README**: [.github/LLM_PROXY_CICD_README.md](.github/LLM_PROXY_CICD_README.md)
- **Design Document**: [.kiro/specs/aws-native-llm-proxy/design.md](.kiro/specs/aws-native-llm-proxy/design.md)
- **Requirements**: [.kiro/specs/aws-native-llm-proxy/requirements.md](.kiro/specs/aws-native-llm-proxy/requirements.md)

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review GitHub Actions logs
3. Check AWS CloudWatch logs
4. Open a GitHub issue with:
   - Workflow run URL
   - Error message
   - Steps to reproduce
   - Expected behavior

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-XX | Initial release |

## Next Steps

1. **Bootstrap infrastructure**: Run the bootstrap workflow
2. **Create first release**: Tag and push `llm-proxy-v1.0.0`
3. **Monitor deployment**: Watch the workflow and smoke tests
4. **Verify service**: Test endpoints and check logs
5. **Configure monitoring**: Set up SNS email alerts
6. **Document**: Update team documentation with deployment process

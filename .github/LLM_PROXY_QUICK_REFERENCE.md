# LLM Proxy Quick Reference

## Deploy Pipeline

```bash
# Build
pnpm --filter @llm-proxy/app build

# Preview changes
pnpm --filter @llm-proxy/app diff:prod

# Deploy
pnpm --filter @llm-proxy/app deploy:prod
```

## Monitor Pipeline

```bash
# Check status
aws codepipeline get-pipeline-state \
  --name llm-proxy-production-pipeline \
  --region us-east-2

# View logs
aws logs tail /aws/codebuild/llm-proxy-production-validate --follow
aws logs tail /aws/codebuild/llm-proxy-production-build-docker --follow
aws logs tail /aws/codebuild/llm-proxy-production-deploy --follow

# Manually trigger
aws codepipeline start-pipeline-execution \
  --name llm-proxy-production-pipeline \
  --region us-east-2
```

## Verify Deployment

```bash
# Health endpoint
curl https://llm-proxy.cig.technology/health

# Models endpoint
curl https://llm-proxy.cig.technology/v1/models

# CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name llm-proxy-production \
  --region us-east-2
```

## Rollback

```bash
# Option 1: Revert code
git revert <commit-hash>
git push origin main

# Option 2: Redeploy previous image
export LLM_PROXY_IMAGE_URI=<previous-image-uri>
pnpm --filter @llm-proxy/app deploy:prod

# Option 3: SST rollback
pnpm --filter @llm-proxy/app sst rollback --stage production
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pipeline fails at Source | Check CodeStar connection status |
| Pipeline fails at Validate | Check CodeBuild logs, fix code |
| Pipeline fails at Build | Check Docker build, verify ECR |
| Pipeline fails at Deploy | Check SST logs, verify env vars |
| Endpoints not responding | Wait 30-60s, check CloudWatch logs |

## Environment Variables

```bash
AWS_REGION=us-east-2
AWS_ACCOUNT_ID=520900722378
AWS_KEY_ID=<from .env>
AWS_SECRET_ACCESS_KEY=<from .env>

INFRA_CREATE_PIPELINES=true
INFRA_PIPELINE_REPO_NAME=compute-intelligence-graph
INFRA_PIPELINE_REPO_OWNER=cigtechnology
INFRA_PIPELINE_BRANCH_PROD=main
INFRA_CODESTAR_CONNECTION_ARN=arn:aws:codestar-connections:us-east-2:520900722378:connection/<id>
```

## Resources

- Main Documentation: `.github/LLM_PROXY_DEPLOYMENT.md`
- AWS CodePipeline: https://docs.aws.amazon.com/codepipeline/
- AWS CodeBuild: https://docs.aws.amazon.com/codebuild/
- SST: https://docs.sst.dev/

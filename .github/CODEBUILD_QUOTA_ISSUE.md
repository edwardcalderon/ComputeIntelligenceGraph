# CodeBuild Quota Issue - Resolution Guide

## Problem
The pipeline is failing at the Validate stage with the error:
```
Error calling startBuild: Cannot have more than 0 builds in queue for the account
(Service: AWSCodeBuild; Status Code: 400; Error Code: AccountLimitExceededException)
```

## Root Cause
The AWS account has a service quota limit that's preventing CodeBuild from starting new builds. This is typically one of:
1. Account-level concurrent build limit is set to 0
2. Specific compute environment quota is exhausted
3. Account needs AWS Support to increase quotas

## Current Quotas (us-east-2)
- Linux/Small: 10 concurrent builds (sufficient)
- Linux/Medium: 10 concurrent builds (sufficient)
- Linux/Large: 10 concurrent builds (sufficient)
- Build projects: 5000 (sufficient)

## Solutions

### Option 1: Request AWS Support (Recommended)
Contact AWS Support to increase the account-level CodeBuild concurrent build limit:
1. Go to AWS Support Center
2. Create a case requesting increase for "CodeBuild concurrent builds"
3. Request increase from 0 to at least 5

### Option 2: Use AWS Lambda for Build Steps (Workaround)
Replace CodeBuild with Lambda functions for simpler build steps:
- Validation: Use Lambda to run linting
- Build: Keep CodeBuild for Docker (requires privileged mode)
- Deploy: Use Lambda to invoke SST deployment

### Option 3: Simplify Pipeline
Reduce the number of build stages:
- Combine Validate + Build into a single stage
- Use smaller compute types (BUILD_GENERAL1_SMALL)
- Skip tests in CI/CD (run locally only)

## Current Status
✅ GitHub connection: Working (Source stage succeeds)
✅ CodePipeline: Configured and ready
❌ CodeBuild: Blocked by quota limit

## Next Steps
1. **Contact AWS Support** to increase CodeBuild concurrent build quota
2. Once quota is increased, pipeline will automatically retry
3. Monitor pipeline execution in AWS CodePipeline console

## Manual Retry
Once the quota is increased, manually trigger the pipeline:
```bash
aws codepipeline start-pipeline-execution \
  --pipeline-name llm-proxy-production-pipeline \
  --region us-east-2 \
  --profile aws-cig
```

Or push a new commit to main branch to trigger automatically.

## Temporary Workaround
If you need to deploy immediately without waiting for AWS Support:
1. Deploy Lambda function manually:
   ```bash
   cd packages/llm-proxy
   pnpm run deploy:production
   ```
2. Push Docker image to ECR manually:
   ```bash
   docker build -f packages/llm-proxy/Dockerfile -t llm-proxy:latest .
   aws ecr get-login-password --region us-east-2 --profile aws-cig | \
     docker login --username AWS --password-stdin 520900722378.dkr.ecr.us-east-2.amazonaws.com
   docker tag llm-proxy:latest 520900722378.dkr.ecr.us-east-2.amazonaws.com/llm-proxy-production:latest
   docker push 520900722378.dkr.ecr.us-east-2.amazonaws.com/llm-proxy-production:latest
   ```

## References
- [AWS CodeBuild Service Quotas](https://docs.aws.amazon.com/codebuild/latest/userguide/limits.html)
- [Service Quotas Console](https://console.aws.amazon.com/servicequotas/)
- [AWS Support Center](https://console.aws.amazon.com/support/)

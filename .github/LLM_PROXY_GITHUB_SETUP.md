# LLM Proxy GitHub Actions Setup

This guide explains how to configure GitHub Actions for the LLM Proxy CI/CD pipeline.

## Prerequisites

1. **AWS Account**: With appropriate permissions
2. **GitHub Repository**: With admin access
3. **Docker Hub Account** (optional): For pushing images to Docker Hub

## Step 1: Create IAM Role for GitHub Actions

### Using AWS Console

1. Go to **IAM** → **Roles** → **Create role**
2. Select **Web identity** as the trusted entity type
3. Configure the following:
   - **Identity provider**: `token.actions.githubusercontent.com`
   - **Audience**: `sts.amazonaws.com`
4. Click **Next**
5. Attach the following policies:
   - `AdministratorAccess` (for simplicity; restrict in production)
6. Name the role: `github-actions-llm-proxy-role`
7. Click **Create role**

### Using AWS CLI

```bash
# Create the role
aws iam create-role \
  --role-name github-actions-llm-proxy-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
        },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          "StringLike": {
            "token.actions.githubusercontent.com:sub": "repo:edwardcalderon/ComputeIntelligenceGraph:*"
          }
        }
      }
    ]
  }'

# Attach policy
aws iam attach-role-policy \
  --role-name github-actions-llm-proxy-role \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Get the role ARN
aws iam get-role \
  --role-name github-actions-llm-proxy-role \
  --query 'Role.Arn' \
  --output text
```

## Step 2: Configure GitHub Repository Secrets

### Required Secrets

1. **AWS_ROLE_TO_ASSUME**
   - Value: ARN of the IAM role created above
   - Example: `arn:aws:iam::123456789012:role/github-actions-llm-proxy-role`

### Optional Secrets

1. **DOCKERHUB_TOKEN** (if pushing to Docker Hub)
   - Value: Docker Hub personal access token
   - How to create:
     1. Go to Docker Hub → Account Settings → Security
     2. Click "New Access Token"
     3. Name it: `github-actions`
     4. Copy the token

### Setting Secrets via GitHub UI

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Enter the secret name and value
4. Click **Add secret**

### Setting Secrets via GitHub CLI

```bash
# Set AWS_ROLE_TO_ASSUME
gh secret set AWS_ROLE_TO_ASSUME \
  --body "arn:aws:iam::123456789012:role/github-actions-llm-proxy-role"

# Set DOCKERHUB_TOKEN
gh secret set DOCKERHUB_TOKEN \
  --body "your-docker-hub-token"
```

## Step 3: Configure GitHub Repository Variables

### Optional Variables

1. **AWS_REGION**
   - Value: `us-east-2` (or your preferred region)
   - Default: `us-east-2`

2. **LLM_PROXY_DOMAIN**
   - Value: `llm-proxy.cig.technology` (or your domain)
   - Default: `llm-proxy.cig.technology`

3. **LLM_PROXY_IMAGE_REPOSITORY**
   - Value: `llm-proxy-production`
   - Default: `llm-proxy-production`

4. **DOCKERHUB_USERNAME**
   - Value: Your Docker Hub username
   - Default: `cigtechnology`

5. **DOCKERHUB_LLM_PROXY_IMAGE**
   - Value: `llm-proxy`
   - Default: `llm-proxy`

6. **LLM_PROXY_HOSTED_ZONE_DOMAIN**
   - Value: `cig.technology` (your Route 53 hosted zone)
   - Default: `cig.technology`

### Setting Variables via GitHub UI

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository variable**
3. Enter the variable name and value
4. Click **Add variable**

### Setting Variables via GitHub CLI

```bash
# Set AWS_REGION
gh variable set AWS_REGION --body "us-east-2"

# Set LLM_PROXY_DOMAIN
gh variable set LLM_PROXY_DOMAIN --body "llm-proxy.cig.technology"

# Set other variables
gh variable set LLM_PROXY_IMAGE_REPOSITORY --body "llm-proxy-production"
gh variable set DOCKERHUB_USERNAME --body "cigtechnology"
gh variable set DOCKERHUB_LLM_PROXY_IMAGE --body "llm-proxy"
gh variable set LLM_PROXY_HOSTED_ZONE_DOMAIN --body "cig.technology"
```

## Step 4: Configure AWS Resources

### Create S3 Bucket for SST State

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="llm-proxy-sst-state-${ACCOUNT_ID}-us-east-2"

aws s3 mb "s3://$BUCKET_NAME" --region us-east-2

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Create DynamoDB Table for SST State

```bash
aws dynamodb create-table \
  --table-name llm-proxy-sst-state \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

### Create Route 53 Hosted Zone (if needed)

```bash
# Create hosted zone
aws route53 create-hosted-zone \
  --name cig.technology \
  --caller-reference "$(date +%s)"

# Get the hosted zone ID
aws route53 list-hosted-zones-by-name \
  --dns-name cig.technology \
  --query 'HostedZones[0].Id' \
  --output text
```

## Step 5: Verify Setup

### Test GitHub Actions Permissions

```bash
# Create a test workflow file
cat > .github/workflows/test-setup.yml << 'EOF'
name: Test Setup

on:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-region: us-east-2
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}

      - name: Verify AWS access
        run: |
          aws sts get-caller-identity
          aws s3 ls
          aws dynamodb list-tables
EOF

# Push and run the workflow
git add .github/workflows/test-setup.yml
git commit -m "test: add setup verification workflow"
git push

# Go to Actions and run the workflow manually
```

### Verify Secrets and Variables

```bash
# List secrets (names only)
gh secret list

# List variables
gh variable list

# Verify specific secret exists
gh secret list | grep AWS_ROLE_TO_ASSUME
```

## Step 6: Bootstrap Infrastructure

### Via GitHub Actions

1. Go to **Actions** → **Bootstrap LLM Proxy infrastructure**
2. Click **Run workflow**
3. Optionally enable "Create AWS CodePipeline"
4. Click **Run workflow**
5. Wait for completion (~10-15 minutes)

### Via CLI

```bash
# Trigger the workflow
gh workflow run bootstrap-llm-proxy.yml \
  --ref main \
  -f create_pipelines=false

# Watch the workflow
gh run list --workflow bootstrap-llm-proxy.yml --limit 1
gh run view <RUN_ID> --log
```

## Step 7: Create First Release

### Via GitHub UI

1. Go to **Releases** → **Create a new release**
2. Click **Choose a tag**
3. Type: `llm-proxy-v1.0.0`
4. Click **Create new tag**
5. Add release title and notes
6. Click **Publish release**

### Via CLI

```bash
# Create tag
git tag llm-proxy-v1.0.0
git push origin llm-proxy-v1.0.0

# Create release
gh release create llm-proxy-v1.0.0 \
  --title "LLM Proxy v1.0.0" \
  --notes "Initial release of LLM Proxy"
```

## Troubleshooting

### "AWS_ROLE_TO_ASSUME not found"

**Problem**: Workflow fails with missing secret

**Solution**:
```bash
# Verify secret exists
gh secret list | grep AWS_ROLE_TO_ASSUME

# If missing, set it
gh secret set AWS_ROLE_TO_ASSUME \
  --body "arn:aws:iam::123456789012:role/github-actions-llm-proxy-role"
```

### "Permission denied" when assuming role

**Problem**: GitHub Actions cannot assume the IAM role

**Solution**:
1. Verify the role ARN is correct
2. Check the trust relationship:
   ```bash
   aws iam get-role \
     --role-name github-actions-llm-proxy-role \
     --query 'Role.AssumeRolePolicyDocument'
   ```
3. Ensure the repository name matches the condition in the trust policy

### "ECR repository not found"

**Problem**: Workflow fails when pushing to ECR

**Solution**:
1. The repository is created automatically during the first deployment
2. If it doesn't exist, create it manually:
   ```bash
   aws ecr create-repository \
     --repository-name llm-proxy-production \
     --region us-east-2
   ```

### "S3 bucket already exists"

**Problem**: Bootstrap fails because bucket already exists

**Solution**:
1. This is expected if you've run bootstrap before
2. The workflow will skip bucket creation and continue
3. To use a different bucket, change the `AWS_REGION` variable

## Security Best Practices

### 1. Restrict IAM Role Permissions

Instead of `AdministratorAccess`, use a more restrictive policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*",
        "apigateway:*",
        "sqs:*",
        "dynamodb:*",
        "iam:*",
        "sns:*",
        "cloudwatch:*",
        "logs:*",
        "ecr:*",
        "cloudformation:*",
        "s3:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### 2. Rotate Secrets Regularly

```bash
# Rotate Docker Hub token
# 1. Generate new token in Docker Hub
# 2. Update GitHub secret
gh secret set DOCKERHUB_TOKEN --body "new-token"
```

### 3. Audit Workflow Runs

```bash
# List all workflow runs
gh run list --all

# View specific run details
gh run view <RUN_ID> --log

# Check for failed runs
gh run list --status failure
```

### 4. Enable Branch Protection

1. Go to **Settings** → **Branches**
2. Click **Add rule**
3. Set branch name pattern: `main`
4. Enable:
   - Require a pull request before merging
   - Require status checks to pass
   - Require branches to be up to date

## Monitoring and Alerts

### Set Up Email Notifications

1. Go to **Settings** → **Notifications**
2. Enable "Email notifications for failed workflow runs"

### Set Up Slack Notifications

1. Install the GitHub app in Slack
2. Subscribe to workflow notifications:
   ```
   /github subscribe edwardcalderon/ComputeIntelligenceGraph workflows:*
   ```

### Monitor CloudWatch Alarms

```bash
# Subscribe to SNS topic for alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-2:ACCOUNT_ID:llm-proxy-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

## Next Steps

1. ✅ Create IAM role for GitHub Actions
2. ✅ Configure GitHub repository secrets
3. ✅ Configure GitHub repository variables
4. ✅ Create AWS resources (S3, DynamoDB, Route 53)
5. ✅ Verify setup with test workflow
6. ✅ Bootstrap infrastructure
7. ✅ Create first release
8. ✅ Monitor deployment

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS IAM OIDC Provider](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [AWS SST Documentation](https://docs.sst.dev/)
- [LLM Proxy Deployment Guide](.github/LLMPROXY_DEPLOYMENT_GUIDE.md)
- [LLM Proxy CI/CD README](.github/LLM_PROXY_CICD_README.md)

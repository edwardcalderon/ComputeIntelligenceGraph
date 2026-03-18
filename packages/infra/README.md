# @cig/infra

Infrastructure deployment wrapper for the CIG monorepo. Wraps [@lsts_tech/infra](https://www.npmjs.com/package/@lsts_tech/infra) to provide CIG-specific AWS deployment capabilities including Authentik authentication and dashboard pipelines.

## Installation

```bash
pnpm add @cig/infra
```

## Quick Start

```typescript
import { ConfigManager, InfraWrapper, AuthentikDeployer, DashboardDeployer } from '@cig/infra';

const config = new ConfigManager();
const wrapper = new InfraWrapper(config);

// Deploy Authentik
const authentikDeployer = new AuthentikDeployer(wrapper, config);
const auth = await authentikDeployer.deploy({
  domain: 'auth.example.com',
  adminEmail: 'admin@example.com',
  region: 'us-east-1'
});

// Deploy Dashboard
const dashboardDeployer = new DashboardDeployer(wrapper, config);
const dashboard = await dashboardDeployer.deploy({
  buildPath: './apps/dashboard/.next',
  region: 'us-east-1',
  authentikUrl: auth.connectionDetails.url,
  authentikClientId: auth.connectionDetails.clientId
});

console.log(`Dashboard live at: ${dashboard.url}`);
```

## CLI

```bash
# Deploy Authentik
cig-infra deploy:authentik --env production --region us-east-1

# Deploy Dashboard
cig-infra deploy:dashboard --env production --region us-east-1

# List deployments
cig-infra list --env production
```

## Configuration

Configuration is loaded from environment variables and/or a JSON config file.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AWS_REGION` | ✅ | AWS region (e.g. `us-east-1`) |
| `AWS_ACCOUNT_ID` | | AWS account ID |
| `AWS_PROFILE` | | AWS CLI profile |
| `AUTHENTIK_DOMAIN` | ✅ | Domain for Authentik (e.g. `auth.example.com`) |
| `AUTHENTIK_ADMIN_EMAIL` | ✅ | Admin email for initial setup |
| `AUTHENTIK_VPC_ID` | | VPC ID (uses IAC default if omitted) |
| `AUTHENTIK_SUBNET_ID` | | Subnet ID (uses IAC default if omitted) |
| `DASHBOARD_BUILD_PATH` | ✅ | Path to built dashboard files |
| `DASHBOARD_DOMAIN` | | Custom domain for dashboard |
| `DASHBOARD_AUTHENTIK_INTEGRATION` | | Enable Authentik auth (`true`/`false`) |
| `IAC_MODULES_PATH` | ✅ | Path to `@cig/iac` modules |
| `IAC_NETWORKING_MODULE` | ✅ | Networking module name |
| `IAC_COMPUTE_MODULE` | ✅ | Compute module name |
| `LOG_LEVEL` | | Log level: `debug`, `info`, `warn`, `error` |
| `LOG_TIMESTAMPS` | | Include timestamps (`true`/`false`) |

### Config File

Place a `config/<environment>.json` file in your working directory:

```json
{
  "aws": { "region": "us-east-1" },
  "authentik": {
    "domain": "auth.example.com",
    "adminEmail": "admin@example.com"
  },
  "dashboard": {
    "buildPath": "./apps/dashboard/.next",
    "authentikIntegration": true
  },
  "iac": {
    "modulesPath": "../iac",
    "networkingModule": "networking",
    "computeModule": "compute"
  },
  "logging": { "level": "info", "timestamps": true }
}
```

## IAC Integration

This package integrates with `@cig/iac` Terraform modules:

- `modules/networking` — VPC, subnets, security groups
- `modules/compute` — EC2 / container compute resources

Set `IAC_MODULES_PATH` to point to your `packages/iac` directory.

## Troubleshooting

**`ConfigValidationError: aws.region is required`** — Set the `AWS_REGION` environment variable.

**`IAC_MODULE_NOT_FOUND`** — Verify `IAC_MODULES_PATH` points to a valid `@cig/iac` directory containing `modules/networking` and `modules/compute`.

**`DeploymentError` during networking phase** — Check that the VPC/subnet IDs are valid for the target region, or omit them to use IAC module defaults.

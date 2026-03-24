import { describe, expect, it, vi } from 'vitest';
import { ApiDeployer, buildApiSstEnvironment } from './ApiDeployer.js';
import { InfraWrapper } from '../InfraWrapper.js';
import { ConfigManager } from '../config/ConfigManager.js';

describe('ApiDeployer', () => {
  it('builds SST environment variables for a full API deploy', () => {
    const env = buildApiSstEnvironment({
      domain: 'api.cig.technology',
      region: 'us-east-2',
      imageRepository: 'cig-api-production',
      containerPort: 8080,
      cpu: 512,
      memoryMiB: 1024,
      desiredCount: 1,
      vpcId: 'vpc-123',
      albSecurityGroupId: 'sg-alb',
      publicSubnetIds: ['subnet-public-a', 'subnet-public-b'],
      privateSubnetIds: ['subnet-private-a', 'subnet-private-b'],
      securityGroupIds: ['sg-api'],
      databaseUrlSecretArn: 'arn:aws:secretsmanager:::db',
      jwtSecretArn: 'arn:aws:secretsmanager:::jwt',
      neo4jBoltUri: 'bolt://10.0.2.10:7687',
      neo4jPasswordSecretArn: 'arn:aws:secretsmanager:::neo4j',
      authentikSecretRefs: {
        issuerUrlSecretArn: 'arn:aws:secretsmanager:::issuer',
        jwksUriSecretArn: 'arn:aws:secretsmanager:::jwks',
        tokenEndpointSecretArn: 'arn:aws:secretsmanager:::token',
        oidcClientIdSecretArn: 'arn:aws:secretsmanager:::client-id',
        oidcClientSecretSecretArn: 'arn:aws:secretsmanager:::client-secret',
      },
      corsOrigins: ['https://app.cig.lat'],
      createPipeline: false,
      imageUri: '123456789012.dkr.ecr.us-east-2.amazonaws.com/cig-api-production:v0.1.58',
    });

    expect(env.API_DOMAIN).toBe('api.cig.technology');
    expect(env.API_IMAGE_REPOSITORY).toBe('cig-api-production');
    expect(env.API_ALB_SECURITY_GROUP_ID).toBe('sg-alb');
    expect(env.API_PUBLIC_SUBNET_IDS).toBe('subnet-public-a,subnet-public-b');
    expect(env.API_PRIVATE_SUBNET_IDS).toBe('subnet-private-a,subnet-private-b');
    expect(env.API_SECURITY_GROUP_IDS).toBe('sg-api');
    expect(env.API_CORS_ORIGINS).toBe('https://app.cig.lat');
    expect(env.INFRA_CREATE_PIPELINES).toBe('false');
  });

  it('runs bootstrap deploys without requiring runtime network values', async () => {
    const commandRunner = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '' });
    const deployer = new ApiDeployer(
      {} as InfraWrapper,
      {} as ConfigManager,
      {
        commandRunner,
        packageRoot: '/tmp/cig-infra',
      }
    );

    await deployer.deploy({
      domain: 'api.cig.technology',
      region: 'us-east-2',
      imageRepository: 'cig-api-production',
      bootstrapOnly: true,
      createPipeline: false,
    });

    expect(commandRunner).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'sst', 'deploy', '--stage', 'production', '--yes'],
      expect.objectContaining({
        cwd: '/tmp/cig-infra',
        env: expect.objectContaining({
          INFRA_API_BOOTSTRAP_ONLY: 'true',
          API_IMAGE_REPOSITORY: 'cig-api-production',
        }),
      })
    );
  });
});

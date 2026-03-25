import { describe, expect, it } from 'vitest';
import {
  parseApiCoreTerraformOutputs,
  resolveApiRuntimeConfig,
} from './apiRuntime.js';

describe('api runtime helpers', () => {
  it('parses Terraform JSON outputs for the API core-data environment', () => {
    const outputs = parseApiCoreTerraformOutputs({
      vpc_id: { value: 'vpc-123' },
      public_subnet_ids: { value: ['subnet-public-a', 'subnet-public-b'] },
      private_subnet_ids: { value: ['subnet-private-a', 'subnet-private-b'] },
      alb_security_group_id: { value: 'sg-alb' },
      api_service_security_group_id: { value: 'sg-api' },
      neo4j_security_group_id: { value: 'sg-neo4j' },
      neo4j_bolt_uri: { value: 'bolt://10.0.2.10:7687' },
      neo4j_password_secret_arn: {
        value: 'arn:aws:secretsmanager:us-east-2:123456789012:secret:neo4j',
      },
    });

    expect(outputs).toEqual({
      vpcId: 'vpc-123',
      publicSubnetIds: ['subnet-public-a', 'subnet-public-b'],
      privateSubnetIds: ['subnet-private-a', 'subnet-private-b'],
      albSecurityGroupId: 'sg-alb',
      apiServiceSecurityGroupId: 'sg-api',
      neo4jSecurityGroupId: 'sg-neo4j',
      neo4jBoltUri: 'bolt://10.0.2.10:7687',
      neo4jPasswordSecretArn: 'arn:aws:secretsmanager:us-east-2:123456789012:secret:neo4j',
    });
  });

  it('merges Terraform outputs into the final API runtime config', () => {
    const runtime = resolveApiRuntimeConfig(
      {
        domain: 'api.cig.technology',
        region: 'us-east-2',
        imageRepository: 'cig-api-production',
        containerPort: 8080,
        cpu: 512,
        memoryMiB: 1024,
        desiredCount: 1,
        databaseUrlSecretArn: 'arn:aws:secretsmanager:::db',
        jwtSecretArn: 'arn:aws:secretsmanager:::jwt',
        authentikSecretRefs: {
          issuerUrlSecretArn: 'arn:aws:secretsmanager:::issuer',
          jwksUriSecretArn: 'arn:aws:secretsmanager:::jwks',
          tokenEndpointSecretArn: 'arn:aws:secretsmanager:::token',
          oidcClientIdSecretArn: 'arn:aws:secretsmanager:::client-id',
          oidcClientSecretSecretArn: 'arn:aws:secretsmanager:::client-secret',
        },
        smtpHost: 'mail.example.com',
        smtpPort: 587,
        smtpSecure: true,
        smtpFromEmail: 'notifications@cig.technology',
        smtpAuthEnabled: true,
        smtpUser: 'notifications@cig.technology',
        smtpOtpSubject: 'Your one-time code',
        smtpPasswordSecretArn: 'arn:aws:secretsmanager:::smtp-password',
        corsOrigins: ['https://app.cig.lat'],
      },
      {
        vpcId: 'vpc-123',
        publicSubnetIds: ['subnet-public-a', 'subnet-public-b'],
        privateSubnetIds: ['subnet-private-a', 'subnet-private-b'],
        albSecurityGroupId: 'sg-alb',
        apiServiceSecurityGroupId: 'sg-api',
        neo4jSecurityGroupId: 'sg-neo4j',
        neo4jBoltUri: 'bolt://10.0.2.10:7687',
        neo4jPasswordSecretArn: 'arn:aws:secretsmanager:::neo4j',
        smtpHost: 'mail.example.com',
        smtpPort: 587,
        smtpSecure: true,
        smtpFromEmail: 'notifications@cig.technology',
        smtpAuthEnabled: true,
        smtpUser: 'notifications@cig.technology',
        smtpOtpSubject: 'Your one-time code',
        smtpPasswordSecretArn: 'arn:aws:secretsmanager:::smtp-password',
      }
    );

    expect(runtime.vpcId).toBe('vpc-123');
    expect(runtime.albSecurityGroupId).toBe('sg-alb');
    expect(runtime.securityGroupIds).toEqual(['sg-api']);
    expect(runtime.neo4jBoltUri).toBe('bolt://10.0.2.10:7687');
    expect(runtime.neo4jPasswordSecretArn).toBe('arn:aws:secretsmanager:::neo4j');
    expect(runtime.smtpHost).toBe('mail.example.com');
    expect(runtime.smtpPort).toBe(587);
    expect(runtime.smtpSecure).toBe(true);
    expect(runtime.smtpFromEmail).toBe('notifications@cig.technology');
    expect(runtime.smtpAuthEnabled).toBe(true);
    expect(runtime.smtpUser).toBe('notifications@cig.technology');
    expect(runtime.smtpOtpSubject).toBe('Your one-time code');
    expect(runtime.smtpPasswordSecretArn).toBe('arn:aws:secretsmanager:::smtp-password');
    expect(runtime.corsOrigins).toEqual(['https://app.cig.lat']);
  });
});

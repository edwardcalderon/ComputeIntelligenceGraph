import { DeploymentError } from '../errors.js';
import {
  LlmProxyDeploymentConfig,
  LlmProxyRuntimeConfig,
} from '../types.js';

type TerraformOutputEnvelope<T> = T | { value: T };

function unwrapOutput<T>(value: TerraformOutputEnvelope<T> | undefined, name: string): T {
  if (value === undefined || value === null) {
    throw new DeploymentError(
      `Missing Terraform output: ${name}`,
      'llm-proxy',
      'terraform-outputs'
    );
  }

  if (typeof value === 'object' && value !== null && 'value' in value) {
    return (value as { value: T }).value;
  }

  return value as T;
}

function requireString(value: string | undefined, name: string): string {
  if (!value || value.trim() === '') {
    throw new DeploymentError(`${name} is required`, 'llm-proxy', 'validation');
  }
  return value;
}

function requireStringArray(value: string[] | undefined, name: string): string[] {
  if (!value || value.length === 0) {
    throw new DeploymentError(`${name} is required`, 'llm-proxy', 'validation');
  }
  return value;
}

function requireNumber(value: number | undefined, name: string): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new DeploymentError(`${name} is required`, 'llm-proxy', 'validation');
  }
  return value;
}

export function resolveLlmProxyRuntimeConfig(
  config: LlmProxyDeploymentConfig
): LlmProxyRuntimeConfig {
  return {
    domain: requireString(config.domain, 'domain'),
    region: requireString(config.region, 'region'),
    imageRepository: requireString(config.imageRepository, 'imageRepository'),
    imageUri: requireString(config.imageUri, 'imageUri'),
    lambdaMemoryMb: requireNumber(config.lambdaMemoryMb, 'lambdaMemoryMb'),
    lambdaTimeoutSeconds: requireNumber(config.lambdaTimeoutSeconds, 'lambdaTimeoutSeconds'),
    hostedZoneDomain: config.hostedZoneDomain?.trim() || undefined,
    certificateArn: config.certificateArn?.trim() || undefined,
  };
}

/**
 * LLM Proxy runtime deployment for AWS/SST.
 * @packageDocumentation
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { DeploymentError } from '../errors.js';
import {
  LlmProxyDeploymentConfig,
  LlmProxyDeploymentResult,
  LlmProxyRuntimeConfig,
} from '../types.js';
import { resolveLlmProxyRuntimeConfig } from './llmProxyRuntime.js';

const execFileAsync = promisify(execFile);

export interface LlmProxyDeployerCommandResult {
  stdout: string;
  stderr: string;
}

export interface LlmProxyDeployerCommandRunner {
  (
    command: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv }
  ): Promise<LlmProxyDeployerCommandResult>;
}

export function buildLlmProxySstEnvironment(
  config: LlmProxyDeploymentConfig,
  runtimeConfig?: LlmProxyRuntimeConfig
): NodeJS.ProcessEnv {
  const bootstrapOnly = config.bootstrapOnly ?? false;
  const resolved = runtimeConfig;

  return {
    ...process.env,
    AWS_REGION: config.region,
    INFRA_APP_NAME: config.appName ?? 'llm-proxy',
    INFRA_CREATE_PIPELINES: String(config.createPipeline ?? false),
    INFRA_LLM_PROXY_BOOTSTRAP_ONLY: String(bootstrapOnly),
    INFRA_PIPELINE_REPO: config.pipelineRepo ?? process.env.INFRA_PIPELINE_REPO ?? '',
    INFRA_PIPELINE_PREFIX:
      config.pipelinePrefix ?? process.env.INFRA_PIPELINE_PREFIX ?? 'llm-proxy',
    INFRA_PROJECT_TAG: config.projectTag ?? process.env.INFRA_PROJECT_TAG ?? 'llm-proxy',
    INFRA_PIPELINE_PERMISSIONS_MODE:
      config.pipelinePermissionsMode ??
      process.env.INFRA_PIPELINE_PERMISSIONS_MODE ??
      'admin',
    INFRA_PIPELINE_BRANCH_PROD:
      config.pipelineBranchProduction ??
      process.env.INFRA_PIPELINE_BRANCH_PROD ??
      'main',
    LLM_PROXY_DOMAIN: config.domain,
    LLM_PROXY_IMAGE_REPOSITORY: config.imageRepository,
    LLM_PROXY_IMAGE_URI: resolved?.imageUri ?? config.imageUri,
    LLM_PROXY_LAMBDA_MEMORY_MB: String(
      resolved?.lambdaMemoryMb ?? config.lambdaMemoryMb ?? 256
    ),
    LLM_PROXY_LAMBDA_TIMEOUT_SECONDS: String(
      resolved?.lambdaTimeoutSeconds ?? config.lambdaTimeoutSeconds ?? 90
    ),
    LLM_PROXY_HOSTED_ZONE_DOMAIN:
      resolved?.hostedZoneDomain ?? config.hostedZoneDomain ?? '',
    LLM_PROXY_CERTIFICATE_ARN:
      resolved?.certificateArn ?? config.certificateArn ?? '',
  };
}

function defaultCommandRunner(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
): Promise<LlmProxyDeployerCommandResult> {
  return execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    maxBuffer: 10 * 1024 * 1024,
  }).then((result) => ({
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }));
}

export class LlmProxyDeployer {
  private readonly commandRunner: LlmProxyDeployerCommandRunner;
  private readonly packageRoot: string;

  constructor(
    options?: {
      commandRunner?: LlmProxyDeployerCommandRunner;
      packageRoot?: string;
    }
  ) {
    this.commandRunner = options?.commandRunner ?? defaultCommandRunner;
    this.packageRoot =
      options?.packageRoot ?? path.resolve(__dirname, '..', '..');
  }

  async diff(config: LlmProxyDeploymentConfig): Promise<void> {
    await this.runSst('diff', config);
  }

  async deploy(config: LlmProxyDeploymentConfig): Promise<LlmProxyDeploymentResult> {
    await this.runSst('deploy', config);

    return {
      success: true,
      resourceId: `llm-proxy-${config.stage ?? 'production'}`,
      url: `https://${config.domain}`,
      connectionDetails: {
        apiUrl: `https://${config.domain}`,
        healthUrl: `https://${config.domain}/health`,
        modelsUrl: `https://${config.domain}/v1/models`,
        repositoryName: config.imageRepository,
      },
    };
  }

  private async runSst(
    action: 'deploy' | 'diff',
    config: LlmProxyDeploymentConfig
  ): Promise<void> {
    this.validateDeploymentConfig(config);

    const bootstrapOnly = config.bootstrapOnly ?? false;
    const runtimeConfig =
      bootstrapOnly ? undefined : resolveLlmProxyRuntimeConfig(config);
    const env = buildLlmProxySstEnvironment(config, runtimeConfig);
    const stage = config.stage ?? 'production';
    const useBootstrapHelper = action === 'deploy' && bootstrapOnly;
    const command = useBootstrapHelper ? 'bash' : 'pnpm';
    const args = useBootstrapHelper
      ? ['scripts/bootstrap-llm-proxy.sh']
      : ['exec', 'sst', action, '--stage', stage];
    if (action === 'deploy' && !useBootstrapHelper) {
      args.push('--yes');
    }
    const logPrefix = useBootstrapHelper ? 'bootstrap helper' : `SST ${action}`;

    console.log(`Running ${logPrefix} for LLM Proxy runtime`, {
      stage,
      bootstrapOnly,
      helper: useBootstrapHelper ? 'bootstrap-llm-proxy.sh' : undefined,
      domain: config.domain,
      imageRepository: config.imageRepository,
    });

    try {
      const result = await this.commandRunner(command, args, {
        cwd: this.packageRoot,
        env: useBootstrapHelper ? { ...env, SST_STAGE: stage } : env,
      });

      console.log(
        useBootstrapHelper ? 'Bootstrap helper completed' : `SST ${action} completed`,
        {
          stdout: result.stdout.trim() || undefined,
        }
      );
    } catch (error) {
      throw new DeploymentError(
        `LLM Proxy ${action} failed: ${error instanceof Error ? error.message : String(error)}`,
        'llm-proxy',
        action
      );
    }
  }

  private validateDeploymentConfig(config: LlmProxyDeploymentConfig): void {
    if (!config.domain) {
      throw new DeploymentError('domain is required', 'llm-proxy', 'validation');
    }
    if (!config.region) {
      throw new DeploymentError('region is required', 'llm-proxy', 'validation');
    }
    if (!config.imageRepository) {
      throw new DeploymentError('imageRepository is required', 'llm-proxy', 'validation');
    }
    if (!config.imageUri) {
      throw new DeploymentError('imageUri is required', 'llm-proxy', 'validation');
    }

    if (config.bootstrapOnly) {
      return;
    }

    try {
      resolveLlmProxyRuntimeConfig(config);
    } catch (error) {
      if (error instanceof DeploymentError) {
        throw error;
      }
      throw new DeploymentError(
        `Invalid LLM Proxy runtime configuration: ${error instanceof Error ? error.message : String(error)}`,
        'llm-proxy',
        'validation'
      );
    }
  }
}

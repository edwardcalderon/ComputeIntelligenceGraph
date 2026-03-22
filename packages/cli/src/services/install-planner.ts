import { InstallMode, InstallProfile, NodeConfig } from '../types/runtime.js';
import { resolveCliPaths } from '../storage/paths.js';

export interface InstallPlannerOptions {
  mode: InstallMode;
  profile: InstallProfile;
  apiUrl: string;
  controlPlaneUrl?: string;
}

export interface InstallPlan {
  mode: InstallMode;
  profile: InstallProfile;
  installDir: string;
  dashboardUrl: string;
  nodeConfig: NodeConfig;
}

export class InstallPlanner {
  createPlan(options: InstallPlannerOptions): InstallPlan {
    const paths = resolveCliPaths();
    const nodeConfig: NodeConfig = {
      mode: options.mode,
      profile: options.profile,
      controlPlaneUrl: options.mode === 'managed'
        ? (options.controlPlaneUrl ?? options.apiUrl)
        : 'http://127.0.0.1:8080',
      localApiUrl: options.mode === 'self-hosted' ? 'http://127.0.0.1:8080' : undefined,
      heartbeatIntervalSeconds: 60,
      commandPollIntervalSeconds: 30,
      reconciliationIntervalSeconds: 900,
      discoveryProviders: options.mode === 'self-hosted' ? ['local', 'docker'] : ['local'],
      approvedPermissionTiers: ['tier0'],
      connectorManifests: [],
    };

    return {
      mode: options.mode,
      profile: options.profile,
      installDir: paths.installDir,
      dashboardUrl: options.mode === 'self-hosted' ? 'http://127.0.0.1:3000' : options.apiUrl,
      nodeConfig,
    };
  }
}

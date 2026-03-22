import { DiscoveryScheduler } from '@cig/discovery';
import {
  CommandEnvelope,
  GraphDeltaEnvelope,
  NodeConfig,
  NodeIdentity,
  RuntimeStatus,
} from '@cig/runtime-contracts';
import { NodeConfigStore } from './config-store.js';
import { HeartbeatClient } from './heartbeat-client.js';
import { CommandPoller } from './command-poller.js';

export interface CIGNodeRuntimeDependencies {
  configStore: NodeConfigStore;
  discoveryScheduler?: DiscoveryScheduler;
  heartbeatClient?: HeartbeatClient;
  commandPoller?: CommandPoller;
  now?: () => Date;
}

export class CIGNodeRuntime {
  private readonly configStore: NodeConfigStore;
  private readonly discoveryScheduler: DiscoveryScheduler;
  private readonly heartbeatClient: HeartbeatClient;
  private readonly commandPoller: CommandPoller;
  private readonly now: () => Date;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private commandTimer: ReturnType<typeof setInterval> | null = null;
  private status: RuntimeStatus;

  constructor(deps: CIGNodeRuntimeDependencies) {
    this.configStore = deps.configStore;
    const config = this.configStore.loadConfig();
    this.discoveryScheduler = deps.discoveryScheduler ?? new DiscoveryScheduler();
    this.heartbeatClient =
      deps.heartbeatClient ?? new HeartbeatClient(config.controlPlaneUrl);
    this.commandPoller = deps.commandPoller ?? new CommandPoller(config.controlPlaneUrl);
    this.now = deps.now ?? (() => new Date());
    this.status =
      this.configStore.loadStatus() ?? {
        state: 'new',
        activeConnectors: [],
        pendingPermissionRequests: [],
      };
  }

  async start(): Promise<void> {
    const config = this.configStore.loadConfig();
    const identity = this.requireIdentity();

    this.status = {
      ...this.status,
      nodeId: identity.nodeId,
      state: 'running',
      startedAt: this.status.startedAt ?? this.now().toISOString(),
    };
    this.persistStatus();

    this.discoveryScheduler.on('discovery_complete', () => {
      this.status.lastDiscoveryRunAt = this.now().toISOString();
      this.persistStatus();
    });

    this.discoveryScheduler.start();

    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat(identity);
    }, config.heartbeatIntervalSeconds * 1000);

    this.commandTimer = setInterval(() => {
      void this.pollCommands(identity);
    }, config.commandPollIntervalSeconds * 1000);

    await this.sendHeartbeat(identity);
  }

  stop(): void {
    this.discoveryScheduler.stop();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.commandTimer) {
      clearInterval(this.commandTimer);
      this.commandTimer = null;
    }

    this.status.state = 'offline';
    this.persistStatus();
  }

  enqueueGraphDelta(_delta: GraphDeltaEnvelope): void {
    this.status.lastGraphSyncAt = this.now().toISOString();
    this.persistStatus();
  }

  private async sendHeartbeat(identity: NodeIdentity): Promise<void> {
    await this.heartbeatClient.send(identity.nodeId, {
      ...this.status,
      nodeId: identity.nodeId,
      lastHeartbeatAt: this.now().toISOString(),
    });

    this.status.lastHeartbeatAt = this.now().toISOString();
    this.persistStatus();
  }

  private async pollCommands(identity: NodeIdentity): Promise<void> {
    const command = await this.commandPoller.pollNext(identity.nodeId);
    if (!command) {
      return;
    }

    await this.handleCommand(command);
  }

  private async handleCommand(command: CommandEnvelope): Promise<void> {
    if (command.type === 'run-discovery') {
      await this.discoveryScheduler.runDiscovery();
      return;
    }

    if (command.type === 'refresh-config') {
      this.configStore.loadConfig();
      return;
    }

    if (command.type === 'request-permissions') {
      this.status.pendingPermissionRequests.push({
        id: command.commandId,
        tier: 'tier1',
        scope: 'runtime',
        reason: 'Control plane requested additional permissions',
        requestedAt: this.now().toISOString(),
        status: 'pending',
      });
      this.persistStatus();
    }
  }

  private requireIdentity(): NodeIdentity {
    const identity = this.configStore.loadIdentity();
    if (!identity) {
      throw new Error('Node identity is required before starting cig-node');
    }

    return identity;
  }

  private persistStatus(): void {
    this.configStore.saveStatus(this.status);
  }
}

export function createDefaultNodeConfig(controlPlaneUrl: string): NodeConfig {
  return {
    mode: 'managed',
    profile: 'core',
    controlPlaneUrl,
    heartbeatIntervalSeconds: 60,
    commandPollIntervalSeconds: 30,
    reconciliationIntervalSeconds: 900,
    discoveryProviders: ['local'],
    approvedPermissionTiers: ['tier0'],
    connectorManifests: [],
  };
}

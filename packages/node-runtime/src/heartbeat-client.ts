import { RuntimeStatus } from '@cig/runtime-contracts';

export class HeartbeatClient {
  constructor(
    private readonly controlPlaneUrl: string,
    private readonly getHeaders: () => Record<string, string> = () => ({})
  ) {}

  async send(nodeId: string, status: RuntimeStatus): Promise<void> {
    await fetch(`${this.controlPlaneUrl}/api/v1/nodes/${nodeId}/heartbeats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
      },
      body: JSON.stringify(status),
    });
  }
}

import { RuntimeStatus } from '@cig/runtime-contracts';
import { withExponentialBackoff } from '@cig/discovery';

export class HeartbeatClient {
  constructor(
    private readonly controlPlaneUrl: string,
    private readonly getHeaders: () => Record<string, string> = () => ({})
  ) {}

  async send(nodeId: string, status: RuntimeStatus): Promise<void> {
    await withExponentialBackoff(async () => {
      const response = await fetch(`${this.controlPlaneUrl}/api/v1/nodes/${nodeId}/heartbeats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getHeaders(),
        },
        body: JSON.stringify(status),
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed with status ${response.status}`);
      }
    });
  }
}

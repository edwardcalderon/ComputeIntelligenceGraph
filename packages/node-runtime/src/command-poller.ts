import { CommandEnvelope } from '@cig/runtime-contracts';
import { withExponentialBackoff } from '@cig/discovery';

export class CommandPoller {
  constructor(
    private readonly controlPlaneUrl: string,
    private readonly getHeaders: () => Record<string, string> = () => ({})
  ) {}

  async pollNext(nodeId: string): Promise<CommandEnvelope | null> {
    return withExponentialBackoff(async () => {
      const response = await fetch(`${this.controlPlaneUrl}/api/v1/nodes/${nodeId}/commands/next`, {
        headers: this.getHeaders(),
      });

      if (response.status === 204) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Command poll failed with status ${response.status}`);
      }

      return (await response.json()) as CommandEnvelope;
    });
  }
}

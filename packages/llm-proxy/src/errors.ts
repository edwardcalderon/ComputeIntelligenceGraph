/**
 * Deployment error handling for LLM Proxy.
 * @packageDocumentation
 */

export class DeploymentError extends Error {
  constructor(
    message: string,
    public readonly service: string,
    public readonly phase: string
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

import type { GraphScope } from '@cig/graph';

export interface AuthenticatedScopeUser {
  sub: string;
  tenant?: string;
  workspace?: string;
}

export const DEMO_GRAPH_SCOPE: GraphScope = {
  ownerId: 'demo',
  tenant: 'demo',
  workspace: 'demo',
};

function normalizeOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveGraphScope(user?: AuthenticatedScopeUser): GraphScope | undefined {
  if (process.env.CIG_AUTH_MODE !== 'managed') {
    return undefined;
  }

  const ownerId = normalizeOptionalText(user?.sub);
  const tenant = normalizeOptionalText(user?.tenant || user?.workspace);
  const workspace = normalizeOptionalText(user?.workspace || user?.tenant);

  if (!ownerId && !tenant && !workspace) {
    return undefined;
  }

  return {
    ownerId: ownerId || undefined,
    tenant: tenant || undefined,
    workspace: workspace || undefined,
  };
}

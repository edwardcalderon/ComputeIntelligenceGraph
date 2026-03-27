import type { GraphScope, Resource_Model } from './types';

function normalizeOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeGraphScope(scope?: GraphScope): GraphScope | undefined {
  if (!scope) {
    return undefined;
  }

  const ownerId = normalizeOptionalText(scope.ownerId);
  const tenant = normalizeOptionalText(scope.tenant);
  const workspace = normalizeOptionalText(scope.workspace || scope.tenant);

  if (!ownerId && !tenant && !workspace) {
    return undefined;
  }

  return {
    ownerId: ownerId || undefined,
    tenant: tenant || undefined,
    workspace: workspace || undefined,
  };
}

export function buildGraphScopeConditions(
  alias: string,
  scope?: GraphScope,
  params: Record<string, unknown> = {},
): string[] {
  const normalized = normalizeGraphScope(scope);
  if (!normalized) {
    return [];
  }

  const conditions: string[] = [];

  if (normalized.ownerId) {
    params.ownerId = normalized.ownerId;
    conditions.push(`${alias}.ownerId = $ownerId`);
  }

  if (normalized.tenant) {
    params.tenant = normalized.tenant;
    conditions.push(`${alias}.tenant = $tenant`);
  }

  if (normalized.workspace) {
    params.workspace = normalized.workspace;
    conditions.push(`${alias}.workspace = $workspace`);
  }

  return conditions;
}

export function applyGraphScope(
  resource: Resource_Model,
  scope?: GraphScope,
): Resource_Model {
  const normalized = normalizeGraphScope(scope);
  if (!normalized) {
    return resource;
  }

  return {
    ...resource,
    ownerId: normalized.ownerId ?? resource.ownerId,
    tenant: normalized.tenant ?? resource.tenant,
    workspace: normalized.workspace ?? resource.workspace,
  };
}

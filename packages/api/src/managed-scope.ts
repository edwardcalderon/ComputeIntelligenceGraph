function normalizeOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export interface ManagedUserScope {
  sub?: string;
  tenant?: string | null;
  workspace?: string | null;
}

export interface ManagedIdentityScope {
  userId: string;
  tenant: string | null;
}

export function resolveManagedIdentityScope(user?: ManagedUserScope): ManagedIdentityScope {
  return {
    userId: normalizeOptionalText(user?.sub) || 'unknown',
    tenant: normalizeOptionalText(user?.tenant || user?.workspace) || null,
  };
}

export function buildManagedTenantPredicate(
  alias: string,
  scope: ManagedIdentityScope,
  params: unknown[],
): string {
  const conditions = [`${alias}.user_id = ?`];
  params.push(scope.userId);

  if (scope.tenant) {
    conditions.push(`${alias}.tenant = ?`);
    params.push(scope.tenant);
  }

  return conditions.join(' AND ');
}

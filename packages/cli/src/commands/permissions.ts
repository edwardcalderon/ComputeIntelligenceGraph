import { PermissionTier } from '../types/runtime.js';

const TIERS: Array<{ tier: PermissionTier; summary: string }> = [
  { tier: 'tier0', summary: 'Host bootstrap and runtime installation' },
  { tier: 'tier1', summary: 'Base infrastructure discovery' },
  { tier: 'tier2', summary: 'Expanded infra metadata, cost, logs, events' },
  { tier: 'tier3', summary: 'Sensitive connector access' },
  { tier: 'tier4', summary: 'Mutating actions and remediation' },
];

export async function permissions(): Promise<void> {
  console.log('CIG permission tiers');
  TIERS.forEach(({ tier, summary }) => {
    console.log(`  - ${tier}: ${summary}`);
  });
}

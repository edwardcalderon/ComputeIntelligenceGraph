import type { InstallProfile } from '../types/runtime.js';

export type CanonicalInstallProfile = 'discovery' | 'full';

export function normalizeInstallProfile(profile?: string | null): CanonicalInstallProfile {
  if (profile === 'full') {
    return 'full';
  }

  return 'discovery';
}

export function normalizeApiProfile(profile: InstallProfile): 'core' | 'full' {
  return profile === 'full' ? 'full' : 'core';
}

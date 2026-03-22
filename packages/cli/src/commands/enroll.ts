import { enrollmentFlow } from './enrollment.js';

export interface EnrollCommandOptions {
  apiUrl: string;
  profile?: 'core' | 'full';
  token?: string;
}

export async function enroll(options: EnrollCommandOptions): Promise<void> {
  const { identity } = await enrollmentFlow({
    apiUrl: options.apiUrl,
    profile: options.profile,
    enrollmentToken: options.token,
  });

  console.log(`✓ Node enrolled successfully as ${identity.targetId}`);
}

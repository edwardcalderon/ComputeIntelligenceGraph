import { enrollmentFlow } from './enrollment.js';
import { intro, outro, spinner } from '@clack/prompts';

export interface EnrollCommandOptions {
  apiUrl: string;
  profile?: 'core' | 'full';
  token?: string;
}

export async function enroll(options: EnrollCommandOptions): Promise<void> {
  intro('CIG Enrollment');
  const enrollSpinner = spinner();
  enrollSpinner.start('Enrolling node...');
  const { identity } = await enrollmentFlow({
    apiUrl: options.apiUrl,
    profile: options.profile,
    enrollmentToken: options.token,
  });

  enrollSpinner.stop('Node enrollment completed.');
  outro(`Node enrolled successfully as ${identity.targetId}`);
}

/**
 * Doctor Command — Prerequisite Checks
 *
 * Runs all prerequisite checks and displays a readiness summary.
 * Does not install anything; only verifies system requirements.
 *
 * Requirement 7.14: THE CLI SHALL provide a `cig doctor` command that runs
 * all prerequisite checks and displays a readiness summary without installing
 */

import { runAllChecks } from '../prereqs.js';

export async function doctor(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    CIG System Check                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = await runAllChecks();

  const checkNames = [
    'Docker Engine',
    'Docker Compose v2.0+',
    'Free Memory (≥4 GB)',
    'Free Disk Space (≥10 GB)',
    'Port Availability',
  ];

  let allPassed = true;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = checkNames[i];
    const status = result.passed ? '✓' : '✗';
    const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m'; // Green or Red
    const resetColor = '\x1b[0m';

    console.log(`${statusColor}${status}${resetColor} ${name}`);
    console.log(`  ${result.message}`);

    if (!result.passed && result.remediation) {
      console.log(`  Remediation: ${result.remediation}`);
      allPassed = false;
    }

    console.log();
  }

  // Display overall readiness status
  console.log('╔════════════════════════════════════════════════════════════╗');
  if (allPassed) {
    console.log('║                  ✓ System is ready                          ║');
    console.log('║                                                            ║');
    console.log('║  You can now run `cig install` to set up CIG.              ║');
  } else {
    console.log('║                  ✗ System is not ready                      ║');
    console.log('║                                                            ║');
    console.log('║  Please address the issues above and run `cig doctor`      ║');
    console.log('║  again to verify.                                          ║');
  }
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!allPassed) {
    throw new Error('System is not ready.');
  }
}

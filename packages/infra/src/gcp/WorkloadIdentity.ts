/**
 * Workload Identity Federation setup helper for GCP + GitHub Actions
 * @packageDocumentation
 *
 * Run this once per project to replace service account JSON keys with
 * short-lived OIDC tokens. After setup, the only values you need in GitHub are:
 *   - GCP_WORKLOAD_IDENTITY_PROVIDER  (output of this script — not a secret, just a string)
 *   - GCP_SERVICE_ACCOUNT             (the SA email — not a secret, just a string)
 *
 * No private key is stored anywhere. Tokens are ephemeral (1-hour lifetime).
 *
 * Usage:
 *   npx ts-node packages/infra/scripts/setup-workload-identity.ts
 */

import { execSync } from 'child_process';

export interface WorkloadIdentityConfig {
  /** GCP project ID */
  project: string;
  /** GitHub repository in "owner/repo" format */
  githubRepo: string;
  /** Service account email that GitHub Actions will impersonate */
  serviceAccount?: string;
  /** Pool ID to create (default: github-actions) */
  poolId?: string;
  /** Provider ID inside the pool (default: github) */
  providerId?: string;
}

export interface WorkloadIdentityOutput {
  /** Full provider resource name — set this as GCP_WORKLOAD_IDENTITY_PROVIDER secret */
  providerResourceName: string;
  /** Service account email — set this as GCP_SERVICE_ACCOUNT secret */
  serviceAccount: string;
}

/**
 * One-time setup: create a Workload Identity Pool + Provider and bind the
 * service account, then print the two GitHub secrets you need to set.
 *
 * Idempotent — safe to re-run if the pool already exists.
 */
export async function setupWorkloadIdentity(
  config: WorkloadIdentityConfig
): Promise<WorkloadIdentityOutput> {
  const {
    project,
    githubRepo,
    serviceAccount = `cig-lat@${project}.iam.gserviceaccount.com`,
    poolId = 'github-actions',
    providerId = 'github',
  } = config;

  const run = (cmd: string): string => {
    console.log(`→ ${cmd}`);
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  };

  const safeRun = (cmd: string): string => {
    try {
      return run(cmd);
    } catch (e: any) {
      const msg: string = e.message ?? '';
      if (msg.includes('already exists')) {
        console.log('  (already exists, skipping)');
        return '';
      }
      throw e;
    }
  };

  // 1. Create pool
  console.log('\n[1/4] Creating Workload Identity Pool…');
  safeRun(
    `gcloud iam workload-identity-pools create "${poolId}" \
      --project="${project}" \
      --location="global" \
      --display-name="GitHub Actions"`
  );

  // 2. Get pool name
  const poolName = run(
    `gcloud iam workload-identity-pools describe "${poolId}" \
      --project="${project}" \
      --location="global" \
      --format="value(name)"`
  );

  // 3. Create OIDC provider
  console.log('\n[2/4] Creating OIDC provider…');
  safeRun(
    `gcloud iam workload-identity-pools providers create-oidc "${providerId}" \
      --project="${project}" \
      --location="global" \
      --workload-identity-pool="${poolId}" \
      --display-name="GitHub OIDC" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
      --attribute-condition="assertion.repository=='${githubRepo}'"`
  );

  // 4. Bind SA → pool (allow impersonation from this repo only)
  console.log('\n[3/4] Binding service account to pool…');
  safeRun(
    `gcloud iam service-accounts add-iam-policy-binding "${serviceAccount}" \
      --project="${project}" \
      --role="roles/iam.workloadIdentityUser" \
      --member="principalSet://iam.googleapis.com/${poolName}/attribute.repository/${githubRepo}"`
  );

  // 5. Get provider resource name
  console.log('\n[4/4] Retrieving provider resource name…');
  const providerResourceName = run(
    `gcloud iam workload-identity-pools providers describe "${providerId}" \
      --project="${project}" \
      --location="global" \
      --workload-identity-pool="${poolId}" \
      --format="value(name)"`
  );

  const output: WorkloadIdentityOutput = {
    providerResourceName,
    serviceAccount,
  };

  console.log('\n✅ Workload Identity Federation configured!');
  console.log('\nAdd these two secrets to GitHub → Settings → Secrets → Actions:');
  console.log('');
  console.log(`  GCP_WORKLOAD_IDENTITY_PROVIDER = ${providerResourceName}`);
  console.log(`  GCP_SERVICE_ACCOUNT            = ${serviceAccount}`);
  console.log('');
  console.log('Then remove GCP_SA_KEY if it exists — it is no longer needed.');

  return output;
}

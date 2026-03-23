/**
 * GCP cloud scanner provider (stub).
 *
 * Enumerates GCP resources using the Google Cloud SDK.
 * This is a foundational stub — full implementation requires
 * the GCP client libraries and service account from `cig connect gcp`.
 *
 * Phase 3.4: Cartography Scan Service — Cloud Providers
 */

export interface ScanAsset {
  asset_type: string;
  provider: string;
  identifier: string;
  metadata_json: Record<string, unknown>;
}

export interface CloudScanResult {
  scan_type: 'cloud';
  provider: 'gcp';
  status: 'completed' | 'failed';
  summary_json: Record<string, unknown>;
  assets: ScanAsset[];
}

/**
 * Scan GCP resources using saved service account credentials.
 * Currently a stub that returns the credential detection status.
 */
export async function scanGCP(): Promise<CloudScanResult> {
  const assets: ScanAsset[] = [];

  // Check for GCP credentials
  const hasCredentials = !!(
    process.env['GOOGLE_APPLICATION_CREDENTIALS'] ||
    process.env['GCP_PROJECT']
  );

  if (!hasCredentials) {
    return {
      scan_type: 'cloud',
      provider: 'gcp',
      status: 'failed',
      summary_json: {
        error: 'No GCP credentials configured. Run `cig connect gcp --service-account <path>` first.',
        asset_count: 0,
      },
      assets: [],
    };
  }

  // Stub: In a full implementation, this would use @google-cloud/compute, @google-cloud/storage, etc.
  // to enumerate Compute instances, VPCs, GCS buckets, IAM, Cloud SQL, Cloud Functions.
  assets.push({
    asset_type: 'cloud_project',
    provider: 'gcp',
    identifier: process.env['GCP_PROJECT'] ?? 'unknown',
    metadata_json: {
      project: process.env['GCP_PROJECT'] ?? null,
      credentials_path: process.env['GOOGLE_APPLICATION_CREDENTIALS'] ?? null,
      scan_note: 'Stub scan — full enumeration requires GCP client library integration',
    },
  });

  return {
    scan_type: 'cloud',
    provider: 'gcp',
    status: 'completed',
    summary_json: {
      project: process.env['GCP_PROJECT'] ?? 'unknown',
      asset_count: assets.length,
    },
    assets,
  };
}

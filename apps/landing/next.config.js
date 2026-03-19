const { execSync } = require('node:child_process');

/** @type {import('next').NextConfig} */
const legacyBasePath = '/ComputeIntelligenceGraph';
const useLegacyBasePath = process.env.LEGACY_BASEPATH === 'true';

const { version } = require('../../package.json');

function loadReleaseMetadata() {
  try {
    return require('../../release-metadata.json');
  } catch {
    return null;
  }
}

function resolveReleaseMetadata() {
  const fallbackTag = `v${version}`;
  const releaseMetadata = loadReleaseMetadata();
  const metadataMatchesVersion = releaseMetadata?.version === version;
  let releaseTag =
    process.env.NEXT_PUBLIC_RELEASE_TAG ||
    (metadataMatchesVersion ? releaseMetadata.releaseTag : '') ||
    fallbackTag;
  let buildNumber =
    process.env.NEXT_PUBLIC_APP_BUILD ||
    (metadataMatchesVersion && releaseMetadata?.buildNumber != null
      ? String(releaseMetadata.buildNumber)
      : '');

  try {
    const tags = execSync('git tag --points-at HEAD', {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .split('\n')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const buildTagPattern = new RegExp(`^v${escapedVersion}\\+build\\.(\\d+)$`);
    const buildTag = tags.find((tag) => buildTagPattern.test(tag));

    if (!buildNumber && buildTag) {
      releaseTag = buildTag;
      buildNumber = buildTag.match(buildTagPattern)?.[1] || '';
    } else if (releaseTag === fallbackTag && tags.includes(fallbackTag)) {
      releaseTag = fallbackTag;
    }
  } catch {
    // Fall back to env vars when git metadata is unavailable at build time.
  }

  return {
    releaseTag,
    buildNumber,
  };
}

const { releaseTag, buildNumber } = resolveReleaseMetadata();

const nextConfig = {
  transpilePackages: ['@cig/auth', '@cig/ui', '@edcalderon/auth'],
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Primary domain deploys at root, while legacy GitHub Pages deploys under /ComputeIntelligenceGraph.
  basePath: useLegacyBasePath ? legacyBasePath : '',
  assetPrefix: useLegacyBasePath ? legacyBasePath : '',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_BUILD: buildNumber,
    NEXT_PUBLIC_RELEASE_TAG: releaseTag,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://cig.lat',
    NEXT_PUBLIC_LEGACY_SITE_URL:
      process.env.NEXT_PUBLIC_LEGACY_SITE_URL ||
      'https://edwardcalderon.github.io/ComputeIntelligenceGraph',
    NEXT_PUBLIC_DASHBOARD_URL: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001',
  },
};

module.exports = nextConfig;

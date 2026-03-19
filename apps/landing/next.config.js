const { execSync } = require('node:child_process');

/** @type {import('next').NextConfig} */
const legacyBasePath = '/ComputeIntelligenceGraph';
const useLegacyBasePath = process.env.LEGACY_BASEPATH === 'true';

const { version } = require('../../package.json');

function resolveReleaseMetadata() {
  const fallbackTag = `v${version}`;
  let releaseTag = process.env.NEXT_PUBLIC_RELEASE_TAG || fallbackTag;
  let buildNumber = process.env.NEXT_PUBLIC_APP_BUILD || '';

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

    if (buildTag) {
      releaseTag = buildTag;
      buildNumber = buildTag.match(buildTagPattern)?.[1] || '';
    } else if (tags.includes(fallbackTag)) {
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
  transpilePackages: ['@cig/auth', '@edcalderon/auth'],
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
  },
};

module.exports = nextConfig;

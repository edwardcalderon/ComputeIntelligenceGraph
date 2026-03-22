/** @type {import('next').NextConfig} */
const { version } = require('../../package.json');

function loadReleaseMetadata() {
  try { return require('../../release-metadata.json'); } catch { return null; }
}

const meta = loadReleaseMetadata();
const metaOk = meta?.version === version;
const buildNumber = process.env.NEXT_PUBLIC_APP_BUILD
  || (metaOk && meta.buildNumber != null ? String(meta.buildNumber) : '');
const releaseTag = process.env.NEXT_PUBLIC_RELEASE_TAG
  || (metaOk ? meta.releaseTag : `v${version}`);

const nextConfig = {
  // Standalone output bundles server.js + node_modules into .next/standalone/
  // Required by infra/docker/Dockerfile.dashboard for production containers.
  output: 'standalone',
  transpilePackages: ['@cig/auth', '@cig/ui'],
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_BUILD: buildNumber,
    NEXT_PUBLIC_RELEASE_TAG: releaseTag,
    // Fallback to localhost landing so logout works in local dev even without .env.local
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_AUTHENTIK_URL: process.env.NEXT_PUBLIC_AUTHENTIK_URL || 'https://auth.cig.technology',
    NEXT_PUBLIC_AUTHENTIK_CLIENT_ID: process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID || 'G4D6S7WXUoCNZxY7uZSbD08zO3cuXEZwSyUATw2v',
  },
};

module.exports = nextConfig;

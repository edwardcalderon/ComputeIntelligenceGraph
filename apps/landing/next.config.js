/** @type {import('next').NextConfig} */
const legacyBasePath = '/ComputeIntelligenceGraph';
const useLegacyBasePath = process.env.LEGACY_BASEPATH === 'true';

const { version } = require('../../package.json');

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
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://cig.lat',
    NEXT_PUBLIC_LEGACY_SITE_URL:
      process.env.NEXT_PUBLIC_LEGACY_SITE_URL ||
      'https://edwardcalderon.github.io/ComputeIntelligenceGraph',
  },
};

module.exports = nextConfig;

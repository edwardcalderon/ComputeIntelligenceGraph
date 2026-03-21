/** @type {import('next').NextConfig} */
const { version } = require('../../package.json');

const nextConfig = {
  // Standalone output bundles server.js + node_modules into .next/standalone/
  // Required by infra/docker/Dockerfile.dashboard for production containers.
  output: 'standalone',
  transpilePackages: ['@cig/ui'],
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    // Fallback to localhost landing so logout works in local dev even without .env.local
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  },
};

module.exports = nextConfig;

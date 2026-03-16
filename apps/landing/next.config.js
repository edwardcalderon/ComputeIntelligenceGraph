/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const repoName = '/ComputeIntelligenceGraph';

const { version } = require('../../package.json');

const nextConfig = {
  transpilePackages: [],
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages deploys under /<repo-name>/
  basePath: isProd ? repoName : '',
  assetPrefix: isProd ? repoName : '',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

module.exports = nextConfig;

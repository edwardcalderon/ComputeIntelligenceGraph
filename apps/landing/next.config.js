/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const repoName = '/ComputeIntelligenceGraph';

const nextConfig = {
  transpilePackages: [],
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages deploys under /<repo-name>/
  basePath: isProd ? repoName : '',
  assetPrefix: isProd ? repoName : '',
};

module.exports = nextConfig;

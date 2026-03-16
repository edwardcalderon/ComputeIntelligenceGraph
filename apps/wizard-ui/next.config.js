/** @type {import('next').NextConfig} */
const { version } = require('../../package.json');

const nextConfig = {
  transpilePackages: [],
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

module.exports = nextConfig;

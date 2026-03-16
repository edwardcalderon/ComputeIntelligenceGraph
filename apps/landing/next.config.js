/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [],
  output: 'export',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

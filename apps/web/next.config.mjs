/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: isGithubPages ? '/aegis-protocol' : '',
  assetPrefix: isGithubPages ? '/aegis-protocol/' : '',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@aegis-protocol/sdk'],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubActions ? '/kintai-app' : '',
  assetPrefix: isGitHubActions ? '/kintai-app/' : '',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

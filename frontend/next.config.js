/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
      ignoreDuringBuilds: true,
    },
  typescript: {
      ignoreBuildErrors: true,
    },
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
};

module.exports = nextConfig;
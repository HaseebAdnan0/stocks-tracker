/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for easier deployment
  output: 'standalone',

  // Optimize for production
  poweredByHeader: false,

  // External packages for server-side (Next.js 15+)
  serverExternalPackages: ['better-sqlite3'],
};

module.exports = nextConfig;

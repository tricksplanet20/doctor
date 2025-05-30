import { securityHeaders } from './lib/security.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true // Temporarily disable TS checking during build
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.doctorbangladesh.com',
        pathname: '/wp-content/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'topdoctorlist.com',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3001', 'topdoctorlist.com'],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/doctors',
        destination: '/',
        permanent: true,
      },
      {
        source: '/find-doctor',
        destination: '/',
        permanent: true,
      },
    ];
  },
  poweredByHeader: false,
};

/** @type {import('next').NextConfig} */
const config = {
  ...nextConfig,
  typescript: {
    ignoreBuildErrors: true // Temporarily disable TS during build
  }
};

export default config;
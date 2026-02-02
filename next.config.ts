import type { NextConfig } from 'next';
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  distDir: 'out',
  output: 'standalone',
  serverExternalPackages: ["@supabase/supabase-js"],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
    ],
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

// Export the configuration with PWA support
// Disable PWA in development to prevent Fast Refresh issues
const withPWAConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Disable in development to prevent Fast Refresh issues
  disable: process.env.NODE_ENV === 'development', // Only enable in production
})(nextConfig);

export default withPWAConfig;

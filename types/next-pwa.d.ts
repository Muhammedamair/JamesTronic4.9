declare module 'next-pwa' {
  import { type NextConfig } from 'next';

  interface PWAConfig {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    // Common PWA options
    publicExcludes?: string[];
    swSrc?: string;
    buildExcludes?: string[];
    minimumCacheTimeout?: number;
    cacheOnFrontEndNav?: boolean;
    disable?: boolean;
    scope?: string;
    sw?: string;
    reloadOnOnline?: boolean;
    subdomainPrefix?: string;
    basePath?: string;
    [key: string]: any;
  }

  function withPWA(pwaConfig: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}
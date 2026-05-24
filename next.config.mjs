/**
 * @file next.config.mjs
 * @description Next.js build configuration for the SPEI mock UI; enables standalone output and applies NEXT_PUBLIC_BASE_PATH so the app can serve at "/" in dev and "/mock-spei" behind the VM1 nginx reverse proxy.
 * @author Carlos Mejía
 * @project MIPIT-PoC — Cross-border Instant Payments Middleware
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};

export default nextConfig;

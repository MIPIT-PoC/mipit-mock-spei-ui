/**
 * Next.js config — SPEI mock UI.
 * basePath se setea via NEXT_PUBLIC_BASE_PATH (build arg).
 * - Local dev: vacío → root.
 * - VM1 detrás de nginx 443: basePath="/mock-spei".
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};

export default nextConfig;

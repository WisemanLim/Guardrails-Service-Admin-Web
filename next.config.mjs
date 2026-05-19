/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Browser-side API calls go to the Admin API directly. The base URL must be
  // injected at build time because client bundles are static.
  env: {
    NEXT_PUBLIC_ADMIN_API_BASE_URL:
      process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? 'http://localhost:8084',
  },
};
export default nextConfig;

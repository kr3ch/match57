/** @type {import('next').NextConfig} */
// The frontend NEVER proxies /api/* through Vercel. All REST + WebSocket
// traffic must hit the backend directly via NEXT_PUBLIC_API_URL (see
// lib/api.ts and components/providers/RealtimeProvider.tsx). Routing /api/*
// through the Vercel edge would strip the cross-site auth cookie and produce
// random 401 not_authenticated errors, so we deliberately do NOT define any
// rewrites here.
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};

module.exports = nextConfig;

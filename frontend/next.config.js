/** @type {import('next').NextConfig} */
// Static export for GitHub Pages: set STATIC_EXPORT=1 (and optionally
// NEXT_PUBLIC_BASE_PATH=/match57). In dev (no STATIC_EXPORT), we keep the
// rewrite proxy to the local backend on :8000.
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
  ...(isExport
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
        basePath: basePath || undefined,
        assetPrefix: basePath || undefined,
        env: {
          NEXT_PUBLIC_BASE_PATH: basePath,
        },
      }
    : {
        async rewrites() {
          // In dev, proxy /api/* to the local FastAPI backend so the
          // frontend can call same-origin URLs (no CORS dance) and we
          // can also reuse the WS handshake. Accept both
          // ``NEXT_PUBLIC_API_URL`` (legacy) and ``NEXT_PUBLIC_API_BASE``
          // (current); default to http://localhost:8000 so ``npm run
          // dev`` works out of the box.
          const api =
            process.env.NEXT_PUBLIC_API_URL ||
            process.env.NEXT_PUBLIC_API_BASE ||
            "http://localhost:8000";
          return [
            { source: "/api/:path*", destination: `${api}/api/:path*` },
          ];
        },
      }),
};

module.exports = nextConfig;

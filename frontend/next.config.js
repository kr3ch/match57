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
          const api = process.env.NEXT_PUBLIC_API_URL;
          if (!api) return [];
          return [
            {
              source: "/api/:path*",
              destination: `${api}/api/:path*`,
            },
          ];
        },
      }),
};

module.exports = nextConfig;

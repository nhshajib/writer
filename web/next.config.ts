import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static site: every page runs in the browser and talks to Supabase directly,
  // so it can be hosted anywhere (Netlify, Vercel, any static host) from `out/`.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;

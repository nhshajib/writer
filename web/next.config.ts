import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static site: every page runs in the browser and talks to Supabase directly,
  // so it can be hosted anywhere (Netlify, Vercel, any static host) from `out/`.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // The Word add-in runs TypeWit's session engine (supabase/functions/_shared) in the browser.
  experimental: { externalDir: true },
};

export default nextConfig;

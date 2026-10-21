/** Hosting previews must never become search results, even with an inherited production override. */
export function allowIndexing(env: {
  VERCEL_ENV?: string; VERCEL?: string; NETLIFY?: string; CONTEXT?: string; NODE_ENV?: string;
  NEXT_PUBLIC_NOINDEX?: string; NEXT_PUBLIC_ALLOW_INDEXING?: string;
}): boolean {
  if (env.NEXT_PUBLIC_NOINDEX === "true" || env.NEXT_PUBLIC_ALLOW_INDEXING === "false") return false;
  // typewit.com is hosted on Netlify. Every Vercel deployment is a test copy.
  if (env.VERCEL || env.VERCEL_ENV) return false;
  if (env.CONTEXT) return env.CONTEXT === "production";
  return env.NODE_ENV !== "development";
}

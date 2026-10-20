import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/** Lets people add TypeWit to their Home Screen. Optional: everything works in the browser too. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TypeWit",
    short_name: "TypeWit",
    description: "Your words in Google Docs and Word, without typing.",
    start_url: "/app/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#ffffff",
    icons: [
      { src: "/brand/mark-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/mark-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/mark-square-1024.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
    ],
  };
}

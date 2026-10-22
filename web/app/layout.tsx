import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { RecoveryRedirect } from "@/components/RecoveryRedirect";
import { PUBLIC_ROBOTS, SITE_URL } from "@/lib/seo";
import { THEME_SCRIPT } from "@/lib/themeScript";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: PUBLIC_ROBOTS,
  appleWebApp: { capable: true, title: "TypeWit", statusBarStyle: "default" },
  title: {
    default: "Auto Typer for Google Docs & Word · TypeWit",
    template: "%s · TypeWit",
  },
  description:
    "Schedule approved text entry into Google Docs and Microsoft Word. Preserve supported formatting and control pacing for authorized testing. Start free.",
  // Google Search Console ownership check: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the code from its
  // "HTML tag" method (the content="…" value) in the hosting settings, then rebuild.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  twitter: { card: "summary_large_image", images: [`${SITE_URL}/twitter-image.png`] },
  openGraph: {
    title: "TypeWit",
    description: "Scheduled, formatted text entry for Google Docs and Word.",
    url: SITE_URL,
    siteName: "TypeWit",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout reach the screen edges on iPhone; safe-area padding keeps content clear.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf6fc" },
    { media: "(prefers-color-scheme: dark)", color: "#000f22" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply a Light or Dark choice before the first paint, so the page doesn't flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <RecoveryRedirect />
        {children}
      </body>
    </html>
  );
}

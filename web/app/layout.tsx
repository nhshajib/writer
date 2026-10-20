import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { RecoveryRedirect } from "@/components/RecoveryRedirect";
import { INDEXABLE, SITE_URL } from "@/lib/seo";
import { THEME_SCRIPT } from "@/lib/themeScript";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...(INDEXABLE ? {} : { robots: { index: false, follow: false } }),
  appleWebApp: { capable: true, title: "TypeWit", statusBarStyle: "default" },
  title: {
    default: "TypeWit · Your words in Google Docs and Word, without typing",
    template: "%s · TypeWit",
  },
  description:
    "TypeWit enters text you approve into your Google Docs or Word documents, step by step, for people who find typing difficult, slow or painful.",
  // Google Search Console ownership check: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the code from its
  // "HTML tag" method (the content="…" value) in the hosting settings, then rebuild.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  openGraph: {
    title: "TypeWit",
    description: "Your words in Google Docs and Word, without typing.",
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
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

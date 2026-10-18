import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://typewit.com"),
  title: {
    default: "TypeWit · Your words in Google Docs, without typing",
    template: "%s · TypeWit",
  },
  description:
    "TypeWit enters text you approve into your Google Docs, step by step, for people who find typing difficult, slow or painful.",
  openGraph: {
    title: "TypeWit",
    description: "Your words in Google Docs, without typing.",
    url: "https://typewit.com",
    siteName: "TypeWit",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}

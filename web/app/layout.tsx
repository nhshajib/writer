import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://typewit.com"),
  title: {
    default: "TypeWit: your words in Google Docs, without the typing",
    template: "%s · TypeWit",
  },
  description:
    "TypeWit enters text you approve into your Google Docs, step by step, for people who find typing difficult, slow or painful.",
  openGraph: {
    title: "TypeWit",
    description: "Your words in Google Docs, without the typing.",
    url: "https://typewit.com",
    siteName: "TypeWit",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <Header />
        <main id="main" tabIndex={-1}>
          <div className="container">{children}</div>
        </main>
        <Footer />
      </body>
    </html>
  );
}

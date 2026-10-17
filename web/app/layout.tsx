import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Writer: assistive writing into Google Docs",
  description:
    "Writer enters text you approve into your Google Docs, step by step, for people who find typing difficult.",
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
        <footer className="site-footer">
          <div className="container">
            <nav aria-label="Footer">
              <Link href="/responsible-use">Responsible use</Link>
              <Link href="/pricing">Pricing</Link>
              <span>© {new Date().getFullYear()} Writer</span>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
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
        <footer className="site-footer">
          <div className="container">
            <div className="footer-grid">
              <div>
                <p style={{ color: "var(--text)", fontWeight: 700, fontSize: "1.1rem", margin: "0 0 0.5rem" }}>TypeWit</p>
                <p style={{ maxWidth: 340 }}>Assistive writing for people who find typing difficult. Your words, entered into your own Google Docs.</p>
              </div>
              <nav aria-labelledby="footer-product">
                <h2 id="footer-product">Product</h2>
                <ul>
                  <li><Link href="/#how">How it works</Link></li>
                  <li><Link href="/pricing">Pricing</Link></li>
                  <li><Link href="/pricing#pro-steps">Get Pro</Link></li>
                </ul>
              </nav>
              <nav aria-labelledby="footer-account">
                <h2 id="footer-account">Account</h2>
                <ul>
                  <li><Link href="/signup">Create account</Link></li>
                  <li><Link href="/login">Sign in</Link></li>
                  <li><Link href="/app/billing">Billing</Link></li>
                </ul>
              </nav>
              <nav aria-labelledby="footer-trust">
                <h2 id="footer-trust">Company</h2>
                <ul>
                  <li><Link href="/responsible-use">Responsible use</Link></li>
                  <li><Link href="/privacy">Privacy</Link></li>
                  <li><Link href="/terms">Terms</Link></li>
                  <li><Link href="/support">Support</Link></li>
                </ul>
              </nav>
            </div>
            <p className="footer-bottom">© {new Date().getFullYear()} TypeWit. Payments are processed securely by Stripe.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

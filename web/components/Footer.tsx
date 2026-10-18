"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Full footer on public pages; a single quiet line inside the app. */
export function Footer() {
  const inApp = usePathname().startsWith("/app");
  if (inApp) {
    return (
      <footer className="app-footer">
        <div className="container">
          <span>© {new Date().getFullYear()} TypeWit</span>
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/responsible-use">Responsible use</Link>
        </div>
      </footer>
    );
  }
  return (
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
        <p className="footer-bottom">
          © {new Date().getFullYear()} TypeWit. Payments are processed securely by Stripe. Illustration by{" "}
          <a href="https://storyset.com" rel="noopener noreferrer">Storyset</a>.
        </p>
      </div>
    </footer>
  );
}

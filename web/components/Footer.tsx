import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Link href="/" className="brand" aria-label="TypeWit home"><Logo /> TypeWit</Link>
            <p style={{ maxWidth: 300, marginTop: "0.5rem" }}>
              Assistive writing for people who find typing difficult. Your words, entered into your own Google Docs and Word documents.
            </p>
          </div>
          <nav aria-labelledby="f-product">
            <h2 id="f-product">Product</h2>
            <ul>
              <li><Link href="/#how">How it works</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/signup">Get started</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="f-help">
            <h2 id="f-help">Help</h2>
            <ul>
              <li><Link href="/support">Support</Link></li>
              <li><Link href="/pricing#faq">Questions</Link></li>
              <li><Link href="/login">Sign in</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="f-legal">
            <h2 id="f-legal">Legal</h2>
            <ul>
              <li><Link href="/responsible-use">Responsible use</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </nav>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} TypeWit</span>
          <span>Payments by Stripe · Works with Google Docs and Microsoft Word</span>
        </div>
      </div>
    </footer>
  );
}

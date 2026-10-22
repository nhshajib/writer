import Link from "next/link";
import { Logo, Wordmark } from "@/components/Logo";
import { Icon } from "@/components/Icons";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-invitation">
          <div><span className="footer-eyebrow">Your words. Your pace.</span><h2>Make room for your next draft.</h2><p>Bring your text. Choose a pace. Stay in control.</p></div>
          <Link href="/signup/" className="btn footer-start">Start for free <Icon.arrowRight /></Link>
        </div>
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="TypeWit home"><Logo /><Wordmark /></Link>
            <p className="footer-about">Your approved text, entered into Google Docs and Microsoft Word on your schedule.</p>
            <span className="footer-origin">Made with care in Bangladesh.</span>
          </div>
          <nav aria-labelledby="f-product">
            <h2 id="f-product">Explore</h2>
            <ul>
              <li><Link href="/#how">How it works</Link></li>
              <li><Link href="/#features">Features</Link></li>
              <li><Link href="/google-docs-auto-typer/">Google Docs</Link></li>
              <li><Link href="/word-auto-typer/">Microsoft Word</Link></li>
              <li><Link href="/pricing/">Plans &amp; pricing</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="f-help">
            <h2 id="f-help">Here to help</h2>
            <ul>
              <li><Link href="/guides/">Guides</Link></li>
              <li><Link href="/support/">Support</Link></li>
              <li><Link href="/#faq">Common questions</Link></li>
              <li><Link href="/login/">Sign in</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="f-legal">
            <h2 id="f-legal">The essentials</h2>
            <ul>
              <li><Link href="/responsible-use/">Responsible use</Link></li>
              <li><Link href="/privacy/">Privacy</Link></li>
              <li><Link href="/terms/">Terms</Link></li>
            </ul>
          </nav>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} TypeWit Organization</span>
          <span>Payments securely handled by Stripe</span>
        </div>
        <p className="footer-responsibility">For authorized testing and document workflows. Academic cheating and false claims of authorship are prohibited.</p>
      </div>
    </footer>
  );
}

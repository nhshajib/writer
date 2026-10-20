import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { Icon } from "@/components/Icons";
import { Logo, Wordmark } from "@/components/Logo";

/** Sign in, sign up and password reset: one card, the story on the left and the form on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-split">
        <AuthVisual />
        <div className="auth-side">
          <div className="auth-side-top">
            <Link href="/" className="brand"><Logo /><Wordmark /></Link>
            <Link href="/" className="pill-link"><Icon.arrowRight />Back to site</Link>
          </div>
          <main id="main" tabIndex={-1} className="auth-main">{children}</main>
          <nav className="auth-side-foot" aria-label="Legal and help">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/responsible-use">Responsible use</Link>
            <Link href="/support">Help</Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

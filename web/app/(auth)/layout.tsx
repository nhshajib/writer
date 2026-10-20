import Link from "next/link";
import { Suspense } from "react";
import { AuthFooter, AuthTabs } from "@/components/auth/AuthChrome";
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
          <main id="main" tabIndex={-1} className="auth-main">
            <div className="auth-main-inner">
              <Suspense><AuthTabs /></Suspense>
              {children}
            </div>
          </main>
          <AuthFooter />
        </div>
      </div>
    </div>
  );
}

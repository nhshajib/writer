"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AuthFooter, AuthTabs } from "@/components/auth/AuthChrome";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { Icon } from "@/components/Icons";
import { Logo, Wordmark } from "@/components/Logo";

/** A focused sign-in shell; signup and recovery retain their established layout. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Sign-in has a focused, card-free shell; signup and recovery keep their existing layouts.
  if (pathname === "/login" || pathname === "/login/") return (
    <div className="signin-page">
      <main id="main" tabIndex={-1} className="signin-main">{children}</main>
      <AuthFooter fullNames />
    </div>
  );
  return (
    <div className="auth-page">
      <div className="auth-split">
        <AuthVisual />
        <div className="auth-side">
          <div className="auth-side-top">
            <Link href="/" className="brand"><Logo /><Wordmark /></Link>
            <Link href="/" className="auth-back"><Icon.arrowRight />Home</Link>
          </div>
          <main id="main" tabIndex={-1} className="auth-main">
            <div className="auth-main-inner">
              <AuthTabs />
              {children}
            </div>
          </main>
          <AuthFooter />
        </div>
      </div>
    </div>
  );
}

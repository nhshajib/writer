"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LegalDialog } from "@/components/LegalDialog";

/** "Sign in | Join" above the form. Each tab is its own page, so links and the back button work. */
export function AuthTabs() {
  const path = usePathname().replace(/\/$/, "");
  // Read after load, so the tabs are in the pre-rendered page and nothing shifts.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    setQuery(next ? `?next=${encodeURIComponent(next)}` : "");
  }, [path]);
  if (path !== "/login" && path !== "/signup") return null;
  return (
    <nav className="auth-tabs" aria-label="Sign in or join">
      <Link href={`/login/${query}`} aria-current={path === "/login" ? "page" : undefined}>Sign in</Link>
      <Link href={`/signup/${query}`} aria-current={path === "/signup" ? "page" : undefined}>Join</Link>
    </nav>
  );
}

/** The policies open in place, so reading them doesn't lose what's been typed. */
export function AuthFooter() {
  return (
    <nav className="auth-side-foot" aria-label="Policies and help">
      <LegalDialog doc="privacy" className="foot-link">Privacy</LegalDialog>
      <LegalDialog doc="terms" className="foot-link">Terms</LegalDialog>
      <LegalDialog doc="agreement" className="foot-link">Responsible use</LegalDialog>
      <Link href="/support/">Help</Link>
    </nav>
  );
}

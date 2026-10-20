"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { Logo, Wordmark } from "@/components/Logo";
import { supabase } from "@/lib/supabase";

export function Header() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const client = supabase();
    client.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = client.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) => (pathname.replace(/\/$/, "") === href ? "page" : undefined);
  const links = (
    <>
      <Link href="/#how">How it works</Link>
      <Link href="/#who">Who it&apos;s for</Link>
      <Link href="/pricing/" aria-current={current("/pricing")}>Pricing</Link>
    </>
  );

  return (
    <header className="site-header">
      <div className="container">
        <div className="bar">
          <Link href="/" className="brand" aria-label="TypeWit home"><Logo /><Wordmark /></Link>
          <nav className="nav nav-center" aria-label="Main">{links}</nav>
          <div className="nav nav-end">
            {signedIn
              ? <Link href="/app" className="btn btn-primary btn-sm">Open dashboard</Link>
              : (
                <>
                  <Link href="/login/" aria-current={current("/login")}>Sign in</Link>
                  <Link href="/signup/" className="btn btn-primary btn-sm">Join free</Link>
                </>
              )}
          </div>
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((v) => !v)}>
            {open ? <Icon.close /> : <Icon.menu />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        <nav id="mobile-menu" className="mobile-menu" data-open={open} hidden={!open} aria-label="Main mobile">
          {links}
          {signedIn
            ? <Link href="/app" className="btn btn-primary btn-block">Open dashboard</Link>
            : (
              <>
                <Link href="/login/">Sign in</Link>
                <Link href="/signup/" className="btn btn-primary btn-block">Join free</Link>
              </>
            )}
        </nav>
      </div>
    </header>
  );
}

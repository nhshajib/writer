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
  // A hairline under the bar only once the page has scrolled, as on iOS.
  const [scrolled, setScrolled] = useState(false);
  // On phones the page's large title collapses into a small one in the bar, as in iOS apps.
  const [titleShown, setTitleShown] = useState(false);
  useEffect(() => {
    const big = document.getElementById("hero-title");
    if (!big) {
      setTitleShown(true);
      return;
    }
    const o = new IntersectionObserver(([e]) => setTitleShown(!e.isIntersecting && e.boundingClientRect.top < 60), { rootMargin: "-52px 0px 0px 0px" });
    o.observe(big);
    return () => o.disconnect();
  }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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
      <Link href="/#features">Features</Link>
      <Link href="/guides/" aria-current={current("/guides")}>Guides</Link>
      <Link href="/pricing/" aria-current={current("/pricing")}>Pricing</Link>
    </>
  );

  return (
    <header className="site-header" data-scrolled={scrolled || undefined} data-title={titleShown || undefined}>
      <div className="container">
        <div className="bar">
          <Link href="/" className="brand" aria-label="TypeWit home"><Logo /><Wordmark /></Link>
          <span className="nav-title" aria-hidden="true">TypeWit</span>
          <nav className="nav nav-center" aria-label="Main">{links}</nav>
          <div className="nav nav-end">
            {signedIn
              ? <Link href="/app" className="btn btn-primary btn-sm">Open dashboard</Link>
              : (
                <>
                  <Link href="/login/" aria-current={current("/login")}>Sign in</Link>
                  <Link href="/signup/" className="btn btn-primary btn-sm">Get started free</Link>
                </>
              )}
          </div>
          <Link href={signedIn ? "/app" : "/login/"} className="nav-compact">{signedIn ? "Open app" : "Sign in"}</Link>
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
                <Link href="/signup/" className="btn btn-primary btn-block">Get started free</Link>
              </>
            )}
        </nav>
      </div>
    </header>
  );
}

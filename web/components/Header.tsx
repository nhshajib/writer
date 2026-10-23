"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Sheet } from "@/components/app/mobile/Sheet";
import { Logo, Wordmark } from "@/components/Logo";
import { supabase } from "@/lib/supabase";

export function Header() {
  const pathname = usePathname();
  const home = pathname === "/";
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); menuButton.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) => (pathname.replace(/\/$/, "") === href ? "page" : undefined);
  const links = (
    <>
      <Link href="/how-it-works/" aria-current={current("/how-it-works")}>How it works</Link>
      <Link href="/use-cases/" aria-current={current("/use-cases")}>Use cases</Link>
      <Link href="/features/" aria-current={current("/features")}>Features</Link>
      <Link href="/pricing/" aria-current={current("/pricing")}>Pricing</Link>
      <Link href="/faq/" aria-current={current("/faq")}>FAQ</Link>
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
                  <Link href="/login/" className={home ? "home-account" : undefined} aria-current={current("/login")}>Sign in</Link>
                  {!home && <Link href="/signup/" className="btn btn-primary btn-sm">Get started free</Link>}
                </>
              )}
          </div>
          <Link href={signedIn ? "/app" : "/login/"} className="nav-compact">{signedIn ? "Open app" : "Sign in"}</Link>
          <button ref={menuButton} type="button" className="menu-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
            {open ? <Icon.close /> : <Icon.menu />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        <Sheet open={open} onClose={() => setOpen(false)} title="Explore TypeWit" className="site-menu-sheet">
        <nav className="public-menu-links" aria-label="Main mobile" onClick={() => setOpen(false)}>
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
        </Sheet>
      </div>
    </header>
  );
}

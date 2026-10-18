"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { supabase } from "@/lib/supabase";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const client = supabase();
    client.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = client.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  // Close the mobile menu after navigating, and with Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) => pathname.replace(/\/$/, "") === href ? "page" : undefined;

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  const links = (
    <>
      <Link href="/#how" >How it works</Link>
      <Link href="/pricing" aria-current={current("/pricing")}>Pricing</Link>
      <Link href="/responsible-use" aria-current={current("/responsible-use")}>Responsible use</Link>
      {signedIn
        ? (
          <>
            <Link href="/app" aria-current={current("/app")}>Dashboard</Link>
            <Link href="/account" aria-current={current("/account")}>Account</Link>
            <button type="button" className="link-button" onClick={signOut}>Sign out</button>
          </>
        )
        : (
          <>
            <Link href="/login" aria-current={current("/login")}>Sign in</Link>
            <Link href="/signup" className="button small">Start free</Link>
          </>
        )}
    </>
  );

  return (
    <header className="site-header">
      <div className="container">
        <div className="bar">
          <Link href="/" className="brand" aria-label="TypeWit home">
            <span className="brand-mark" aria-hidden="true">T</span>
            TypeWit
          </Link>
          <nav className="nav" aria-label="Main">{links}</nav>
          <button
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Icon.close /> : <Icon.menu />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        <nav id="mobile-nav" className="mobile-nav" data-open={open} aria-label="Main mobile" hidden={!open}>
          {links}
        </nav>
      </div>
    </header>
  );
}

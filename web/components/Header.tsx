"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const client = supabase();
    client.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = client.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  const link = (href: string, label: string) => (
    <Link href={href} aria-current={pathname === href ? "page" : undefined}>
      {label}
    </Link>
  );

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">TypeWit</Link>
        <nav className="nav" aria-label="Main">
          {link("/pricing", "Pricing")}
          {link("/responsible-use", "Responsible use")}
          {signedIn
            ? (
              <>
                {link("/app", "Dashboard")}
                {link("/account", "Account")}
                <button type="button" className="button secondary small" onClick={signOut}>Sign out</button>
              </>
            )
            : (
              <>
                {link("/login", "Sign in")}
                <Link href="/signup" className="button small">Get started</Link>
              </>
            )}
        </nav>
      </div>
    </header>
  );
}

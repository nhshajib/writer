"use client";

import Link from "next/link";
import { Skeleton } from "@/components/app/Skeleton";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CommandPalette } from "@/components/app/CommandPalette";
import { TabBar } from "@/components/app/mobile/TabBar";
import { NotificationBell } from "@/components/app/NotificationBell";
import { UserMenu } from "@/components/app/UserMenu";
import { AgreementGate } from "@/components/dashboard/AgreementGate";
import { Icon } from "@/components/Icons";
import { Logo, Wordmark } from "@/components/Logo";
import { ToastProvider } from "@/components/Toast";
import { DashboardProvider, PLAN_LIMITS, useDashboardLoader } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const MAIN_NAV = [
  { href: "/app", label: "Home", icon: Icon.home },
  { href: "/app/sessions", label: "Sessions", icon: Icon.list },
  { href: "/app/documents", label: "Documents", icon: Icon.doc },
];
const ACCOUNT_NAV = [
  { href: "/app/connections", label: "Connected accounts", icon: Icon.user },
  { href: "/app/billing", label: "Plan & usage", icon: Icon.card },
  { href: "/app/settings", label: "Settings", icon: Icon.gear },
];

/** The signed-in app: a quiet sidebar (a drawer on phones), a top bar with search, updates and New session, and the page. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const router = useRouter();
  const { session, state, value } = useDashboardLoader();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);

  // Close the drawer on navigation and with Escape; move focus sensibly.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    sidebar.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
      // Keep Tab inside the open drawer; the page behind it is inert.
      if (e.key === "Tab" && sidebar.current) {
        const items = [...sidebar.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useScrollRestoration(pathname);

  if (!session || state.status === "loading") {
    return <Skeleton label="Loading your dashboard…" />;
  }
  if (state.status === "error") {
    return (
      <main id="main" className="auth">
        <div className="auth-box" role="alert">
          <h1>Something went wrong</h1>
          <p className="sub">{state.message}</p>
          <div className="auth-form">
            <button type="button" className="btn btn-primary btn-block" onClick={() => window.location.reload()}>Try again</button>
            <Link className="btn btn-block" href="/support/">Get help</Link>
            <button type="button" className="link-btn" onClick={() => supabase().auth.signOut().then(() => router.push("/"))}>Sign out</button>
          </div>
        </div>
      </main>
    );
  }
  if (!value) return null;
  const needsAgreement = value.profile.agreed_terms_version !== CURRENT_TERMS_VERSION;
  const needsAge = !value.profile.age_confirmed_at;
  if (needsAgreement || needsAge) {
    return <AgreementGate needsAgreement={needsAgreement} needsAge={needsAge} onDone={(update) => value.setProfile(update)} />;
  }

  const isCurrent = (href: string) =>
    href === "/app"
      ? pathname === "/app"
      : pathname.startsWith(href) || (href === "/app/sessions" && pathname === "/app/session");
  const isPro = value.profile.plan === "pro";
  const limit = PLAN_LIMITS.free.dailyWords;
  const used = Math.min(value.wordsToday, limit);
  const needsYou = value.drips.filter((d) => d.status === "paused" && d.attention).length;
  // Creating a session is a focused flow: no tab bar, its own Back and Continue.
  const focused = pathname === "/app/new";

  const navItem = ({ href, label, icon: NavIcon }: (typeof MAIN_NAV)[number]) => (
    <li key={href}>
      <Link href={href} className="side-link" aria-current={isCurrent(href) ? "page" : undefined}>
        <NavIcon /><span>{label}</span>
        {href === "/app" && needsYou > 0 && <span className="count warn" aria-label={`${needsYou} need${needsYou === 1 ? "s" : ""} you`}>{needsYou}</span>}
      </Link>
    </li>
  );

  return (
    <DashboardProvider value={value}>
      <ToastProvider>
      <div className="app">
        <div className="scrim" data-open={open} onClick={() => setOpen(false)} aria-hidden="true" />

        <aside id="sidebar" ref={sidebar} className="sidebar" data-open={open} aria-label="Dashboard">
          <Link href="/app" className="brand"><Logo /><Wordmark /></Link>
          <nav aria-label="Main">
            <p className="side-section" id="nav-work">Workspace</p>
            <ul className="side-nav" aria-labelledby="nav-work">{MAIN_NAV.map(navItem)}</ul>
            <p className="side-section" id="nav-account">Account</p>
            <ul className="side-nav" aria-labelledby="nav-account">{ACCOUNT_NAV.map(navItem)}</ul>
          </nav>

          <div className="side-foot">
            {!isPro && (
              <Link href="/app/billing" className="usage-line">
                <span className="top"><span>Words today</span><span className="num">{used} / {limit}</span></span>
                <span className={`progress${used >= limit * 0.9 ? " warn" : ""}`} role="meter" aria-label="Words used today"
                  aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
                  <span style={{ width: `${Math.round((used / limit) * 100)}%` }} />
                </span>
                <span className="usage-cta">Free plan · Upgrade for no daily limit</span>
              </Link>
            )}
            <UserMenu />
          </div>
        </aside>

        <div className="app-body" inert={open}>
          <header className="app-top">
            <button ref={menuButton} type="button" className="icon-btn menu-btn" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
              <Icon.menu /><span className="sr-only">Open menu</span>
            </button>
            <Link href="/app" className="brand top-brand"><Logo /><span className="sr-only">TypeWit home</span></Link>
            <CommandPalette />
            <div className="top-actions">
              <NotificationBell />
              <Link href="/app/new" className="btn btn-primary btn-sm top-new" aria-current={pathname === "/app/new" ? "page" : undefined}>
                <Icon.plus /><span>New session</span>
              </Link>
            </div>
          </header>
          <main id="main" className="app-main" tabIndex={-1} data-tabs={!focused}>
            <div className="app-inner">{children}</div>
          </main>
          {!focused && <TabBar needsYou={needsYou} />}
        </div>
      </div>
      </ToastProvider>
    </DashboardProvider>
  );
}

/**
 * Returns to the same place in a list after going Back from a detail page.
 * Positions are kept per address for this tab only.
 */
function useScrollRestoration(pathname: string) {
  const back = useRef(false);
  useEffect(() => {
    const onPop = () => { back.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const key = `typewit:scroll:${pathname}${window.location.search}`;
    if (back.current) {
      back.current = false;
      const y = Number(sessionStorage.getItem(key) ?? 0);
      // Wait for the list to render before scrolling.
      if (y) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        try { sessionStorage.setItem(key, String(Math.round(window.scrollY))); } catch { /* storage blocked */ }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);
}

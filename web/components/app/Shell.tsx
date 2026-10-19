"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgreementGate } from "@/components/dashboard/AgreementGate";
import { Icon } from "@/components/Icons";
import { Logo } from "@/components/Logo";
import { ToastProvider } from "@/components/Toast";
import { DashboardProvider, PLAN_LIMITS, useDashboardLoader } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const MAIN_NAV = [
  { href: "/app", label: "Overview", icon: Icon.home },
  { href: "/app/sessions", label: "Sessions", icon: Icon.list },
  { href: "/app/documents", label: "Documents", icon: Icon.doc },
];
const ACCOUNT_NAV = [
  { href: "/app/billing", label: "Plan & billing", icon: Icon.card },
  { href: "/app/settings", label: "Settings", icon: Icon.gear },
];

/** The signed-in app: a quiet sidebar (a drawer on phones) and the page. */
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

  if (!session || state.status === "loading") {
    return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />Loading your dashboard…</div>;
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
  if (value.profile.agreed_terms_version !== CURRENT_TERMS_VERSION) {
    return <AgreementGate onAgreed={() => value.setProfile({ agreed_terms_version: CURRENT_TERMS_VERSION })} />;
  }

  const isCurrent = (href: string) =>
    href === "/app"
      ? pathname === "/app"
      : pathname.startsWith(href) || (href === "/app/sessions" && pathname === "/app/session");
  const unread = value.notifications.filter((n) => !n.read_at).length;
  const isPro = value.profile.plan === "pro";
  const limit = PLAN_LIMITS.free.dailyWords;
  const used = Math.min(value.wordsToday, limit);

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  const navItem = ({ href, label, icon: NavIcon }: (typeof MAIN_NAV)[number]) => (
    <li key={href}>
      <Link href={href} className="side-link" aria-current={isCurrent(href) ? "page" : undefined}>
        <NavIcon /><span>{label}</span>
        {href === "/app" && unread > 0 && <span className="count" aria-label={`${unread} unread updates`}>{unread}</span>}
      </Link>
    </li>
  );

  return (
    <DashboardProvider value={value}>
      <ToastProvider>
      <div className="app">
        <header className="app-topbar" inert={open}>
          <Link href="/app" className="brand"><Logo /> TypeWit</Link>
          <button ref={menuButton} type="button" className="icon-btn" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)}>
            <Icon.menu /><span className="sr-only">Open menu</span>
          </button>
        </header>

        <div className="scrim" data-open={open} onClick={() => setOpen(false)} aria-hidden="true" />

        <aside id="sidebar" ref={sidebar} className="sidebar" data-open={open} aria-label="Dashboard">
          <Link href="/app" className="brand"><Logo /> TypeWit</Link>
          <Link href="/app/new" className="btn btn-primary btn-block side-new"><Icon.plus /> New session</Link>
          <nav aria-label="Main">
            <ul className="side-nav">{MAIN_NAV.map(navItem)}</ul>
            <p className="side-section" id="nav-account">Account</p>
            <ul className="side-nav" aria-labelledby="nav-account">{ACCOUNT_NAV.map(navItem)}</ul>
          </nav>

          <div className="side-foot">
            {!isPro && (
              <div className="usage-box">
                <div className="top"><strong>Free plan</strong><span>{used} / {limit}</span></div>
                <div className="progress" role="meter" aria-label="Words used today" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
                  <span style={{ width: `${Math.round((used / limit) * 100)}%` }} />
                </div>
                <Link href="/app/billing">Upgrade to Pro</Link>
              </div>
            )}
            <ul className="side-nav">
              <li><Link href="/support" className="side-link"><Icon.help /><span>Help & support</span></Link></li>
            </ul>
            <div className="user-row">
              <span className="avatar" aria-hidden="true">{value.displayName.charAt(0).toUpperCase()}</span>
              <span className="user-meta">
                <strong>{value.displayName}</strong>
                <span>{value.session.user.email}</span>
              </span>
              {isPro && <span className="badge badge-pro">Pro</span>}
              <button type="button" className="icon-btn" onClick={signOut} title="Sign out">
                <Icon.logout /><span className="sr-only">Sign out</span>
              </button>
            </div>
          </div>
        </aside>

        <main id="main" className="app-main" tabIndex={-1} inert={open}>
          <div className="app-inner">{children}</div>
        </main>
      </div>
      </ToastProvider>
    </DashboardProvider>
  );
}

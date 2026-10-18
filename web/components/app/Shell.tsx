"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AgreementGate } from "@/components/dashboard/AgreementGate";
import { Icon } from "@/components/Icons";
import { DashboardProvider, useDashboardLoader } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const NAV = [
  { href: "/app", label: "Overview", icon: Icon.home },
  { href: "/app/sessions", label: "Sessions", icon: Icon.list },
  { href: "/app/documents", label: "Documents", icon: Icon.doc },
];
const ACCOUNT_NAV = [
  { href: "/app/billing", label: "Plan & billing", icon: Icon.card },
  { href: "/app/settings", label: "Settings", icon: Icon.gear },
];

/** The signed-in app: sidebar navigation plus the page, with shared account data. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const router = useRouter();
  const { session, state, value } = useDashboardLoader();

  if (!session || state.status === "loading") {
    return <div className="app-loading" role="status"><span className="spinner" aria-hidden="true" />Loading your dashboard…</div>;
  }
  if (state.status === "error") {
    return (
      <div className="card narrow" role="alert">
        <h1 style={{ fontSize: "1.6rem" }}>We couldn't load your dashboard</h1>
        <p className="muted">{state.message}</p>
        <button type="button" className="button" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }
  if (!value) return null;
  if (value.profile.agreed_terms_version !== CURRENT_TERMS_VERSION) {
    return <AgreementGate onAgreed={() => value.setProfile({ agreed_terms_version: CURRENT_TERMS_VERSION })} />;
  }

  const isCurrent = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`) ||
      (href === "/app/sessions" && pathname === "/app/session");
  const unread = value.notifications.filter((n) => !n.read_at).length;
  const isPro = value.profile.plan === "pro";

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  const link = ({ href, label, icon: NavIcon }: (typeof NAV)[number]) => (
    <li key={href}>
      <Link href={href} className="side-link" aria-current={isCurrent(href) ? "page" : undefined}>
        <NavIcon />
        <span>{label}</span>
        {href === "/app" && unread > 0 && <span className="badge" aria-label={`${unread} unread`}>{unread}</span>}
      </Link>
    </li>
  );

  return (
    <DashboardProvider value={value}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/app/new" className="button block new-button">
            <Icon.plus /> New session
          </Link>
          <nav aria-label="Dashboard">
            <ul className="side-list">{NAV.map(link)}</ul>
            <p className="side-heading" id="side-account">Account</p>
            <ul className="side-list" aria-labelledby="side-account">{ACCOUNT_NAV.map(link)}</ul>
          </nav>

          <div className="side-footer">
            {!isPro && (
              <Link href="/app/billing" className="side-upgrade">
                <strong>Upgrade to Pro</strong>
                <span>Unlimited words. 7 days free.</span>
              </Link>
            )}
            <div className="user-card">
              <span className="avatar" aria-hidden="true">{value.displayName.charAt(0).toUpperCase()}</span>
              <span className="user-meta">
                <strong>{value.displayName}</strong>
                <span>{value.session.user.email}</span>
              </span>
              <span className={isPro ? "pill pro" : "pill"}>{isPro ? "Pro" : "Free"}</span>
            </div>
            <ul className="side-list">
              <li><Link href="/support" className="side-link"><Icon.help /><span>Help & support</span></Link></li>
              <li>
                <button type="button" className="side-link" onClick={signOut}><Icon.logout /><span>Sign out</span></button>
              </li>
            </ul>
          </div>
        </aside>
        <div className="app-content">{children}</div>
      </div>
    </DashboardProvider>
  );
}

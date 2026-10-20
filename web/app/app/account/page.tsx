"use client";

import { useRouter } from "next/navigation";
import { Group, Row } from "@/components/app/mobile/Grouped";
import { Icon } from "@/components/Icons";
import { LegalDialog } from "@/components/LegalDialog";
import { PLAN_LIMITS, useDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { type Theme, useTheme } from "@/lib/theme";

const THEMES: { key: Theme; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

/** Everything about the account in one place: the fourth tab on phones, also reachable on desktop. */
export default function AccountPage() {
  const { displayName, session, profile, wordsToday } = useDashboard();
  const [theme, setTheme] = useTheme();
  const router = useRouter();
  const isPro = profile.plan === "pro";
  const limit = PLAN_LIMITS.free.dailyWords;

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account</h1>
        </div>
      </div>

      <div className="account-card">
        <span className="avatar lg" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
        <div>
          <p className="account-name">{displayName}</p>
          <p className="account-email">{session.user.email}</p>
        </div>
        <span className={`badge ${isPro ? "badge-pro" : ""}`}>{isPro ? "Pro" : "Free"}</span>
      </div>

      <Group title="Plan">
        <Row icon={Icon.card} href="/app/billing/" label="Plan & usage" value={isPro ? "Pro" : `${Math.min(wordsToday, limit)} / ${limit} today`} />
        {(isPro || profile.subscription_status === "canceled") && <Row icon={Icon.receipt} href="/app/billing/manage/" label="Manage billing" />}
      </Group>

      <Group title="Settings">
        <Row icon={Icon.user} href="/app/settings/#profile" label="Profile" />
        <Row icon={Icon.bell} href="/app/settings/#notifications" label="Notifications" />
        <Row icon={Icon.lock} href="/app/settings/#security" label="Security" />
        <Row icon={Icon.shield} href="/app/settings/#privacy" label="Data & privacy" />
      </Group>

      <section className="group" aria-labelledby="appearance-title">
        <h2 className="group-title" id="appearance-title">Appearance</h2>
        <div className="group-list pad-row">
          <div className="seg" role="group" aria-label="Appearance" style={{ "--n": 3, "--i": THEMES.findIndex((t) => t.key === theme) } as React.CSSProperties}>
            {THEMES.map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={theme === key} onClick={() => setTheme(key)}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="group" aria-labelledby="help-title">
        <h2 className="group-title" id="help-title">Help and policies</h2>
        <ul className="group-list">
          <Row icon={Icon.help} href={isPro ? "/support/?priority=1" : "/support/"} label={isPro ? "Priority support" : "Help & support"} value={isPro ? "Pro" : undefined} />
          <li><LegalDialog doc="agreement" className="row-item"><span className="row-label">Responsible Use Agreement</span><span className="row-chevron" aria-hidden="true"><Icon.chevronRight /></span></LegalDialog></li>
          <li><LegalDialog doc="privacy" className="row-item"><span className="row-label">Privacy Policy</span><span className="row-chevron" aria-hidden="true"><Icon.chevronRight /></span></LegalDialog></li>
          <li><LegalDialog doc="terms" className="row-item"><span className="row-label">Terms of Service</span><span className="row-chevron" aria-hidden="true"><Icon.chevronRight /></span></LegalDialog></li>
        </ul>
      </section>

      <Group>
        <Row label="Sign out" onClick={signOut} tone="accent" icon={Icon.logout} />
      </Group>
      <p className="group-footer center">Deleting your account is in <a href="/app/settings/#danger">Settings</a>.</p>
    </>
  );
}

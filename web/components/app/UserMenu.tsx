"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "@/components/app/Popover";
import { Icon } from "@/components/Icons";
import { useDashboard } from "@/lib/dashboard";
import { supabase } from "@/lib/supabase";
import { type Theme, useTheme } from "@/lib/theme";

const THEMES: { key: Theme; label: string; icon: () => React.JSX.Element }[] = [
  { key: "light", label: "Light", icon: Icon.sun },
  { key: "dark", label: "Dark", icon: Icon.moon },
  { key: "system", label: "System", icon: Icon.monitor },
];

/** The person's name at the foot of the sidebar; opens appearance, help and sign out. */
export function UserMenu() {
  const { displayName, session, profile } = useDashboard();
  const [theme, setTheme] = useTheme();
  const router = useRouter();

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  return (
    <Popover
      label={`Account menu for ${displayName}`}
      buttonClass="user-row"
      side="top"
      align="start"
      panelClass="user-panel"
      button={
        <>
          <span className="avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
          <span className="user-meta">
            <strong>{displayName}</strong>
            <span>{session.user.email}</span>
          </span>
          {profile.plan === "pro" && <span className="badge badge-pro">Pro</span>}
          <Icon.chevronDown />
        </>
      }
    >
      {(close) => (
        <>
          <fieldset className="theme-pick">
            <legend>Appearance</legend>
            <div className="seg" style={{ "--n": 3, "--i": THEMES.findIndex((t) => t.key === theme) } as React.CSSProperties}>
              {THEMES.map(({ key, label, icon: ThemeIcon }) => (
                <button key={key} type="button" aria-pressed={theme === key} onClick={() => setTheme(key)}>
                  <ThemeIcon />{label}
                </button>
              ))}
            </div>
          </fieldset>
          <ul className="menu-list">
            <li><Link href="/app/settings" onClick={close}><Icon.gear />Settings</Link></li>
            <li><Link href="/support" onClick={close}><Icon.help />Help &amp; support</Link></li>
            <li><button type="button" onClick={signOut}><Icon.logout />Sign out</button></li>
          </ul>
        </>
      )}
    </Popover>
  );
}

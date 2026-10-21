"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";

const TABS = [
  { href: "/app/", label: "Home", icon: Icon.home, match: (p: string) => p === "/app" },
  { href: "/app/sessions/", label: "Sessions", icon: Icon.list, match: (p: string) => p === "/app/sessions" || p === "/app/session" },
  { href: "/app/documents/", label: "Documents", icon: Icon.doc, match: (p: string) => p === "/app/documents" },
  {
    href: "/app/account/",
    label: "Account",
    icon: Icon.user,
    match: (p: string) => p === "/app/account" || p === "/app/settings" || p === "/app/billing" || p === "/app/connections",
  },
];

/** The four places on a phone, always in the same order at the bottom of the screen. */
export function TabBar({ needsYou }: { needsYou: number }) {
  const path = usePathname().replace(/\/$/, "") || "/";
  return (
    <nav className="tab-bar" aria-label="Main">
      <ul>
        {TABS.map(({ href, label, icon: TabIcon, match }) => (
          <li key={href}>
            <Link href={href} aria-current={match(path) ? "page" : undefined}>
              <span className="tab-icon"><TabIcon />{href === "/app/" && needsYou > 0 && <span className="tab-dot" aria-hidden="true" />}</span>
              <span>{label}</span>
              {href === "/app/" && needsYou > 0 && <span className="sr-only"> ({needsYou} need{needsYou === 1 ? "s" : ""} you)</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { Popover } from "@/components/app/Popover";
import { Icon } from "@/components/Icons";
import { formatRelative, useDashboard } from "@/lib/dashboard";

/** The bell in the top bar: unread count, and the latest updates in a panel. */
export function NotificationBell() {
  const { notifications, markRead, markAllRead } = useDashboard();
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <Popover
      label={unread ? `Updates, ${unread} unread` : "Updates"}
      buttonClass="icon-btn bell"
      panelClass="updates-panel"
      button={<><Icon.bell />{unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}</>}
    >
      {(close) => (
        <>
          <div className="panel-head">
            <h2>Updates</h2>
            {unread > 0 && <button type="button" className="link-btn" onClick={markAllRead}>Mark all as read</button>}
          </div>
          {notifications.length === 0
            ? <p className="panel-empty">We&apos;ll tell you here when a session finishes or needs you.</p>
            : (
              <ul className="updates">
                {notifications.slice(0, 8).map((n) => (
                  <li key={n.id} data-unread={!n.read_at}>
                    <span className={`update-icon ${n.kind === "drip_failed" ? "bad" : "good"}`} aria-hidden="true">
                      {n.kind === "drip_failed" ? <Icon.alert /> : <Icon.check />}
                    </span>
                    <div>
                      {n.drip_id
                        ? <Link href={`/app/session?id=${n.drip_id}`} onClick={() => { markRead(n.id); close(); }}>{n.title}</Link>
                        : <strong>{n.title}</strong>}
                      <p>{n.body}</p>
                      <span className="when">{formatRelative(n.created_at)}{!n.read_at && <span className="sr-only"> (unread)</span>}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </Popover>
  );
}

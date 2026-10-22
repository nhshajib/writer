"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Icon } from "@/components/Icons";
import { PlanLock } from "@/components/app/PlanLock";
import { Popover } from "@/components/app/Popover";
import { Sheet } from "@/components/app/mobile/Sheet";
import { titleOf } from "@/components/app/SessionCards";
import { ACTIVE_STATUSES, useDashboard } from "@/lib/dashboard";
import { canUse } from "@/lib/plans";
import type { useSessionControl } from "@/lib/sessionActions";
import type { Drip } from "@/lib/types";

/**
 * The one "More" menu for a session, the same on Home, the Sessions list and Quick look:
 * open, pause or resume, edit, run again, stop and delete, each shown only when it applies.
 */
export function SessionActionsMenu({ drip, control, before, buttonClass }: {
  drip: Drip;
  control: ReturnType<typeof useSessionControl>;
  /** Items specific to where the menu sits (such as Quick look), listed first. */
  before?: (close: () => void) => ReactNode;
  buttonClass?: string;
}) {
  const { profile } = useDashboard();
  const [confirm, setConfirm] = useState<"stop" | "delete" | null>(null);
  const title = titleOf(drip);
  const word = drip.provider === "microsoft";
  const active = ACTIVE_STATUSES.has(drip.status);
  const running = drip.status === "running" || drip.status === "scheduled";
  const busy = control.busyId === drip.id;
  const editable = active && !drip.attention && !word;
  const canEdit = canUse(profile.plan, "pausedEdit");

  async function act(action: "cancel" | "delete") {
    await control.run(drip.id, action);
    setConfirm(null);
  }

  return (
    <>
      <Popover label={`More for ${title}`} button={<Icon.more />} buttonClass={buttonClass}>
        {(close) => (
          <ul className="menu-list">
            {before?.(close)}
            <li><Link href={`/app/session?id=${drip.id}`}><Icon.arrowRight />{drip.attention ? "Review and fix" : "Open session"}</Link></li>
            {drip.document_url && (
              <li>
                <a href={drip.document_url} target="_blank" rel="noopener noreferrer" onClick={close}>
                  <Icon.external />Open in {word ? "Word" : "Google Docs"}<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            )}
            {running && (
              <li><button type="button" disabled={busy} onClick={() => { close(); control.run(drip.id, "pause"); }}><Icon.pause />Pause</button></li>
            )}
            {drip.status === "paused" && !drip.attention && (
              <li><button type="button" disabled={busy} onClick={() => { close(); control.run(drip.id, "resume"); }}><Icon.play />Resume</button></li>
            )}
            {editable && (canEdit
              ? <li><Link href={`/app/session?id=${drip.id}&edit=1`}><Icon.sliders />Edit text &amp; settings</Link></li>
              : <li><button type="button" disabled title="Editing a session's text and settings is part of Pro"><Icon.sliders />Edit text &amp; settings<PlanLock plan={profile.plan} feature="pausedEdit" /></button></li>)}
            {!active && (word
              ? <li><button type="button" disabled title="Word sessions start from the TypeWit add-in in Word"><Icon.refresh />Run again from Word</button></li>
              : <li><Link href={`/app/new?from=${drip.id}`}><Icon.refresh />Run again…</Link></li>)}
            {active && (
              <li><button type="button" className="danger" onClick={() => { close(); setConfirm("stop"); }}><Icon.stop />Stop…</button></li>
            )}
            {!active && (
              <li><button type="button" className="danger" onClick={() => { close(); setConfirm("delete"); }}><Icon.trash />Delete…</button></li>
            )}
          </ul>
        )}
      </Popover>
      <Sheet open={confirm === "stop"} onClose={() => setConfirm(null)} title="Stop this session?">
        <p className="sheet-text">
          Stopping &quot;{title}&quot; cancels every step still planned. Text already entered stays in your document, and
          the session can&apos;t be resumed.
        </p>
        <div className="stack-4">
          <button type="button" className="btn btn-danger-solid btn-lg btn-block" disabled={busy} onClick={() => act("cancel")}>Stop session</button>
          <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => setConfirm(null)}>Keep going</button>
        </div>
      </Sheet>
      <Sheet open={confirm === "delete"} onClose={() => setConfirm(null)} title="Delete this session?">
        <p className="sheet-text">
          This deletes the saved text and activity log of &quot;{title}&quot; from TypeWit. Your document isn&apos;t changed.
        </p>
        <div className="stack-4">
          <button type="button" className="btn btn-danger-solid btn-lg btn-block" disabled={busy} onClick={() => act("delete")}>Delete session</button>
          <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={() => setConfirm(null)}>Keep it</button>
        </div>
      </Sheet>
    </>
  );
}

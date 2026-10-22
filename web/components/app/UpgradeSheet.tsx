"use client";

import Link from "next/link";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { Sheet } from "@/components/app/mobile/Sheet";
import { isMinor, startCheckout } from "@/lib/billing";
import { useDashboard } from "@/lib/dashboard";
import { canUse, type Feature, FEATURE_PLAN } from "@/lib/plans";
import { DAY_PASS_PRICE, PRO_PRICE } from "@/lib/site";

/** What each locked feature does, in the words the pop-up uses. */
const FEATURE_COPY: Record<Feature, { title: string; text: string }> = {
  unlimitedWords: { title: "Unlimited words", text: "Enter as much text as you need, with no daily limit." },
  writingHours: { title: "Writing hours", text: "Let sessions run only during the hours you choose, in your time zone." },
  drafting: { title: "Drafting rhythm", text: "Occasional temporary typos and false starts, corrected automatically." },
  typingSpeed: { title: "Typing speed", text: "Set words per minute instead of a finish time." },
  customPace: { title: "Custom pace", text: "Adjust speed, pauses, breaks and corrections, and save them as presets." },
  presets: { title: "Saved presets", text: "Save your favourite pace settings and apply them in one tap." },
  revisionPass: { title: "Final revision pass", text: "A short review at the end, then your exact approved text is restored." },
  startLater: { title: "Scheduled starts", text: "Pick a time up to 7 days ahead and let the session start on its own." },
  headingPlacement: { title: "Place text under a heading", text: "Add text at the end of any section of an existing Google Doc." },
  import: { title: "File import", text: "Bring in .docx, .md and .txt files with their formatting." },
  pausedEdit: { title: "Edit while paused", text: "Change the remaining text and settings of a paused session." },
  playback: { title: "Session playback", text: "Replay a session’s confirmed steps in a read-only preview." },
};

const UpgradeContext = createContext<(feature: Feature) => void>(() => {});

/** Opens the upgrade pop-up for a locked feature. */
export function useUpgrade() {
  return useContext(UpgradeContext);
}

type Plan = Parameters<typeof canUse>[0];

/** Props for a control whose feature the plan doesn't include: tapping it opens the upgrade pop-up. */
export function lockedProps(plan: Plan, feature: Feature) {
  return canUse(plan, feature) ? {} : { "data-locked": feature, "aria-disabled": true as const };
}

/** The same for a wrapper, such as a label around a locked radio or checkbox, so a tap anywhere on it counts. */
export function lockedWrap(plan: Plan, feature: Feature) {
  return canUse(plan, feature) ? {} : { "data-locked": feature };
}

/**
 * The upgrade pop-up. Anything marked data-locked opens it on tap, so locked controls never just do
 * nothing; the close button, Escape or a tap outside dismisses it.
 */
export function UpgradeProvider({ children }: { children: ReactNode }) {
  const { profile } = useDashboard();
  const [feature, setFeature] = useState<Feature | null>(null);
  const [busy, setBusy] = useState<"year" | "day" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((f: Feature) => {
    setError(null);
    setFeature(f);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.("[data-locked]");
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      open(el.getAttribute("data-locked") as Feature);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [open]);

  async function buy(offer: "year" | "day") {
    setBusy(offer);
    setError(null);
    try {
      await startCheckout(offer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open checkout.");
      setBusy(null);
    }
  }

  const copy = feature ? FEATURE_COPY[feature] : null;
  const dayPassUnlocks = feature ? FEATURE_PLAN[feature] === "day_pass" && profile.plan === "free" : false;

  return (
    <UpgradeContext.Provider value={open}>
      {children}
      <Sheet open={feature !== null} onClose={() => { setFeature(null); setBusy(null); }} title={copy ? `Unlock ${copy.title.toLowerCase()}` : "Upgrade"} className="upgrade-sheet">
        {copy && feature && (
          <div className="upgrade">
            <span className="upgrade-icon" aria-hidden="true"><Icon.lock /></span>
            <p className="upgrade-text">{copy.text}</p>
            {isMinor(profile)
              ? <p className="alert alert-info">Paid plans have to be bought by an adult. A parent or guardian can contact us from the <Link href="/support/">help page</Link>.</p>
              : (
                <div className="upgrade-actions">
                  <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy !== null} onClick={() => buy("year")}>
                    {busy === "year" ? "Opening checkout…" : "Try Pro free for 7 days"}
                  </button>
                  <p className="upgrade-note-line">Then {PRO_PRICE.year.amount}/month billed yearly, or {PRO_PRICE.month.amount} monthly. Cancel any time.</p>
                  {dayPassUnlocks && (
                    <button type="button" className="btn btn-secondary btn-lg btn-block" disabled={busy !== null} onClick={() => buy("day")}>
                      {busy === "day" ? "Opening checkout…" : `Get a Day Pass · ${DAY_PASS_PRICE}`}
                    </button>
                  )}
                </div>
              )}
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <p className="upgrade-fine">
              <Link href="/app/billing/" onClick={() => setFeature(null)}>Compare plans</Link> · By purchasing you accept the <Link href="/terms/">Terms</Link> and <Link href="/responsible-use/">Responsible Use Agreement</Link>.
            </p>
          </div>
        )}
      </Sheet>
    </UpgradeContext.Provider>
  );
}

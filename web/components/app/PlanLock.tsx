import Link from "next/link";
import { Icon } from "@/components/Icons";
import { type Feature, FEATURE_PLAN, includes, PLAN_NAME } from "@/lib/plans";
import type { PlanTier } from "../../../supabase/functions/_shared/limits";

/**
 * The one lock style in the app: a small badge naming the lowest plan that includes a feature.
 * Not a link, so it can sit inside labels and buttons; the page's UpgradeNote carries the link.
 */
export function PlanLock({ plan, feature, needs }: { plan: PlanTier; feature?: Feature; needs?: PlanTier }) {
  const required = needs ?? (feature ? FEATURE_PLAN[feature] : "pro");
  if (includes(plan, required)) return null;
  return (
    <span className="badge plan-lock" title={`Included with ${PLAN_NAME[required]}`}>
      <Icon.lock />{PLAN_NAME[required]}
      <span className="sr-only"> plan needed</span>
    </span>
  );
}

const GAINS: Record<PlanTier, string> = {
  free: "",
  day_pass: "unlimited words for 24 hours, sessions up to a day, writing hours and customizable writing blocks",
  pro: "drafting with corrected mistakes, custom pace, scheduled starts, placing text under a heading, file import and editing paused sessions",
};

/** The one upgrade prompt per screen, worded for the plan the person is on. Nothing for Pro. */
export function UpgradeNote({ plan }: { plan: PlanTier }) {
  if (plan === "pro") return null;
  return (
    <p className="upgrade-note">
      <Icon.lock />
      <span>
        {plan === "free"
          ? <>Locked options need a <strong>Day Pass</strong> ({GAINS.day_pass}) or <strong>Pro</strong> ({GAINS.pro}).</>
          : <>Your Day Pass is active. <strong>Pro</strong> adds {GAINS.pro}.</>}{" "}
        <Link href="/app/billing/">Compare plans</Link>
      </span>
    </p>
  );
}

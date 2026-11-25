"use client";

import { DiscordMark, GoogleMark } from "@/components/Icons";
import type { SocialProvider } from "@/lib/googleAuth";
import type { SignInMethod } from "@/lib/signInPreference";

export function SocialSignInButtons({ busy, onContinue, prominent = false, lastUsed }: {
  busy: boolean;
  onContinue: (provider: SocialProvider) => void;
  prominent?: boolean;
  lastUsed?: SignInMethod | null;
}) {
  return <div className={`social-sign-in${prominent ? " signin-providers" : ""}`}>
    <button type="button" className="btn btn-google btn-lg btn-block" onClick={() => onContinue("google")} disabled={busy}
      aria-description={lastUsed === "google" ? "Last used on this device" : undefined}>
      <GoogleMark /><span>{prominent ? "Continue with Google" : <><span className="sr-only">Continue with </span>Google</>}</span>
      {lastUsed === "google" && <span className="signin-last-used" aria-hidden="true">Last used</span>}
    </button>
    <button type="button" className="btn btn-discord btn-lg btn-block" onClick={() => onContinue("discord")} disabled={busy}
      aria-description={lastUsed === "discord" ? "Last used on this device" : undefined}>
      <DiscordMark /><span>{prominent ? "Continue with Discord" : <><span className="sr-only">Continue with </span>Discord</>}</span>
      {lastUsed === "discord" && <span className="signin-last-used" aria-hidden="true">Last used</span>}
    </button>
  </div>;
}

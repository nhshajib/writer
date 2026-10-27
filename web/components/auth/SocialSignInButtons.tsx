"use client";

import { DiscordMark, GoogleMark } from "@/components/Icons";
import type { SocialProvider } from "@/lib/googleAuth";

export function SocialSignInButtons({ busy, onContinue }: { busy: boolean; onContinue: (provider: SocialProvider) => void }) {
  return <div className="social-sign-in">
    <button type="button" className="btn btn-google btn-lg btn-block" onClick={() => onContinue("google")} disabled={busy}>
      <GoogleMark /> Continue with Google
    </button>
    <button type="button" className="btn btn-discord btn-lg btn-block" onClick={() => onContinue("discord")} disabled={busy}>
      <DiscordMark /> Continue with Discord
    </button>
  </div>;
}

"use client";

import { useEffect } from "react";
import { clearPendingSignIn, finishSocialSignIn } from "@/lib/signInPreference";
import { supabase } from "@/lib/supabase";

/** UI-only preference tracking; never participates in authentication or authorization. */
export function SignInPreferenceTracker() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    if (query.has("error") || fragment.has("error")) clearPendingSignIn();
    try {
      const { data: { subscription } } = supabase().auth.onAuthStateChange((event, session) => {
        if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) finishSocialSignIn();
      });
      return () => subscription.unsubscribe();
    } catch {
      // An optional UI hint must not make public pages fail when auth is unavailable.
    }
  }, []);
  return null;
}

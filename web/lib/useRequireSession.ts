"use client";

import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Returns the signed-in session, `undefined` while it loads, and sends
 * signed-out visitors to the sign-in page.
 */
export function useRequireSession(): Session | undefined {
  const router = useRouter();
  const [session, setSession] = useState<Session | undefined>(undefined);

  useEffect(() => {
    const client = supabase();
    client.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session);
      else router.replace(loginUrl());
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (next) setSession(next);
      else router.replace(loginUrl());
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return session;
}

/** Sign-in page URL, carrying any error a sign-in provider sent back (e.g. a refused Google account). */
function loginUrl(): string {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const message = query.get("error_description") ?? hash.get("error_description");
  return message ? `/login?error=${encodeURIComponent(message)}` : "/login";
}

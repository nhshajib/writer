"use client";

import { useEffect } from "react";

/**
 * If Supabase sends a password-reset link to the site's home address instead of
 * /reset-password (it does when that address isn't on its allow list), forward it.
 */
export function RecoveryRedirect() {
  useEffect(() => {
    if (/type=recovery/.test(window.location.hash) && !window.location.pathname.startsWith("/reset-password")) {
      window.location.replace(`/reset-password/${window.location.hash}`);
    }
  }, []);
  return null;
}

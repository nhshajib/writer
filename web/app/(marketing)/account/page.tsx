"use client";

import { useEffect } from "react";

/** Old address (still used by Stripe's return links): forwards to Plan & usage. */
export default function AccountRedirect() {
  useEffect(() => {
    // Password-reset links sent before /reset-password existed still land here.
    if (/type=recovery/.test(window.location.hash)) {
      window.location.replace(`/reset-password/${window.location.hash}`);
      return;
    }
    window.location.replace(`/app/billing/${window.location.search}`);
  }, []);
  return <p role="status">Opening Plan & usage…</p>;
}

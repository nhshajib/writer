"use client";

import { useEffect } from "react";

/** Old address (still used by Stripe's return links): forwards to Plan & billing. */
export default function AccountRedirect() {
  useEffect(() => {
    window.location.replace(`/app/billing/${window.location.search}`);
  }, []);
  return <p role="status">Opening Plan & billing…</p>;
}

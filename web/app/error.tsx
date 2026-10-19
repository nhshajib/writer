"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SUPPORT_EMAIL } from "@/lib/site";

/** Shown if a page crashes, instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" tabIndex={-1}>
      <div className="auth">
        <div className="auth-box" role="alert">
          <h1>Something went wrong</h1>
          <p className="sub">
            This page hit an unexpected problem. Your sessions keep running on TypeWit&apos;s servers; nothing was lost.
          </p>
          <div className="auth-form">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={reset}>Try again</button>
            <Link className="btn btn-lg btn-block" href="/app/">Go to your dashboard</Link>
            <p className="small muted center">
              If it keeps happening, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientIssue } from "@/lib/diagnostics";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { reportClientIssue("runtime"); }, [error]);
  return <main id="main" className="auth" tabIndex={-1}><section className="auth-box">
    <h1>Something went wrong</h1><p>Try loading this view again, or return to the homepage.</p>
    <div className="row"><button className="btn btn-primary" onClick={reset}>Try again</button><Link className="btn btn-ghost" href="/">Go home</Link></div>
  </section></main>;
}

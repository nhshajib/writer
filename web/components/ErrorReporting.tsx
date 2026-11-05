"use client";

import { useEffect } from "react";
import { reportClientIssue } from "@/lib/diagnostics";

export function ErrorReporting() {
  useEffect(() => {
    const runtime = () => reportClientIssue("runtime");
    const promise = () => reportClientIssue("promise");
    window.addEventListener("error", runtime);
    window.addEventListener("unhandledrejection", promise);
    return () => { window.removeEventListener("error", runtime); window.removeEventListener("unhandledrejection", promise); };
  }, []);
  return null;
}

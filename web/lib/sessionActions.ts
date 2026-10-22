"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { api } from "./api";
import { useDashboard } from "./dashboard";

export type SessionAction = "pause" | "resume" | "cancel" | "delete";

const DONE: Record<SessionAction, string> = { pause: "Session paused.", resume: "Session resumed.", cancel: "Session stopped.", delete: "Session deleted." };

/** Pause, resume, stop or delete a session from a list or card, then refresh the dashboard. */
export function useSessionControl() {
  const { refresh } = useDashboard();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const run = useCallback(async (id: string, action: SessionAction, body: Record<string, unknown> = {}) => {
    setBusyId(id);
    setError(null);
    try {
      await api(`drips/${id}/${action}`, { method: "POST", body });
      await refresh();
      toast(DONE[action]);
    } catch (e) {
      setError({ id, message: e instanceof Error ? e.message : "That didn't work. Please try again." });
    } finally {
      setBusyId(null);
    }
  }, [refresh, toast]);

  return { run, busyId, error };
}

/** The current time, updated every `ms`, for countdowns. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(tick);
  }, [ms]);
  return now;
}

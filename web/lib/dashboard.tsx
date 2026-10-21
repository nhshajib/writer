"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { rememberAgeBlock } from "./age";
import { recordPendingAge, recordPendingAgreement } from "./googleAuth";
import { supabase } from "./supabase";
import { CURRENT_TERMS_VERSION } from "./terms";
import type { Connection, Drip } from "./types";
import { useRequireSession } from "./useRequireSession";

export interface Profile {
  plan: "free" | "pro";
  subscription_status: string | null;
  email_notifications: boolean;
  /** Per kind of update; missing until the column exists (treated as on). */
  email_on_completed?: boolean;
  email_on_attention?: boolean;
  agreed_terms_version: string | null;
  words_used_today: number;
  usage_date: string;
  /** Set once the country and month and year of birth passed the age check. */
  age_confirmed_at?: string | null;
  birth_year?: number | null;
  birth_month?: number | null;
  /** Pro: saved pacing settings (see set_pace_presets). */
  pace_presets?: PacePreset[];
}

export interface PacePreset {
  name: string;
  timing: "duration" | "speed";
  /** Duration presets: the total time. */
  minutes?: number;
  pace: Record<string, unknown>;
}

export interface AppNotification {
  id: string;
  drip_id: string | null;
  kind: "drip_completed" | "drip_failed";
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

/** Plan limits. The server enforces the same values (supabase/functions/_shared/limits.ts). */
export const PLAN_LIMITS = {
  free: { dailyWords: 150, maxMinutes: 30, activeSessions: 1 },
  pro: { dailyWords: null, maxMinutes: 7 * 24 * 60, activeSessions: 3 },
} as const;

export const ACTIVE_STATUSES = new Set(["scheduled", "running", "paused"]);

interface DashboardData {
  session: Session;
  profile: Profile;
  connections: Connection[];
  drips: Drip[];
  notifications: AppNotification[];
  /** Words used today (UTC), as counted by the server. */
  wordsToday: number;
  displayName: string;
  refresh: () => Promise<void>;
  setProfile: (update: Partial<Profile>) => void;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => void;
}

const DashboardContext = createContext<DashboardData | null>(null);

export function useDashboard(): DashboardData {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside the dashboard layout.");
  return value;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: Profile; connections: Connection[]; drips: Drip[]; notifications: AppNotification[] };

/**
 * Loads everything the dashboard shows, once, and keeps it fresh: realtime
 * for notifications and session events, plus a light poll while anything is active.
 */
export function useDashboardLoader() {
  const session = useRequireSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const client = supabase();
      const [{ data: profile, error: profileError }, conns, list, { data: notes }] = await Promise.all([
        client.from("profiles")
          .select("plan, subscription_status, email_notifications, email_on_completed, email_on_attention, agreed_terms_version, words_used_today, usage_date, age_confirmed_at, birth_year, birth_month, pace_presets")
          .maybeSingle(),
        api<{ connections: Connection[] }>("drips/connections"),
        api<{ drips: Drip[] }>("drips"),
        client.from("notifications").select("id, drip_id, kind, title, body, read_at, created_at")
          .order("created_at", { ascending: false }).limit(20),
      ]);
      if (profileError) throw new Error(profileError.message);
      let current = (profile ?? {
        plan: "free", subscription_status: null, email_notifications: true, agreed_terms_version: null,
        words_used_today: 0, usage_date: "",
      }) as Profile;
      // Someone who ticked the agreement before choosing Google has it recorded now.
      if (current.agreed_terms_version !== CURRENT_TERMS_VERSION && await recordPendingAgreement()) {
        current = { ...current, agreed_terms_version: CURRENT_TERMS_VERSION };
      }
      // Age answers given on the Join form before using Google.
      if (!current.age_confirmed_at) {
        const age = await recordPendingAge();
        if (age === "too_young") {
          rememberAgeBlock();
          await client.auth.signOut();
          window.location.assign("/signup/");
          return;
        }
        if (age === "ok") current = { ...current, age_confirmed_at: new Date().toISOString() };
      }
      setState({
        status: "ready",
        profile: current,
        connections: conns.connections,
        drips: list.drips,
        notifications: (notes ?? []) as AppNotification[],
      });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't load your dashboard." });
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    refresh();
    const client = supabase();
    const channel = client
      .channel(`dashboard-${session.user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "drip_events" }, () => refresh())
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [session, refresh]);

  // Coming back to the app (another tab, the phone waking up, back online): show the server's current state.
  useEffect(() => {
    if (!session) return;
    let last = Date.now();
    const revisit = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 5_000) return;
      last = Date.now();
      refresh();
    };
    document.addEventListener("visibilitychange", revisit);
    window.addEventListener("online", revisit);
    window.addEventListener("focus", revisit);
    return () => {
      document.removeEventListener("visibilitychange", revisit);
      window.removeEventListener("online", revisit);
      window.removeEventListener("focus", revisit);
    };
  }, [session, refresh]);

  const hasActive = state.status === "ready" && state.drips.some((d) => ACTIVE_STATUSES.has(d.status));
  useEffect(() => {
    if (!hasActive) return;
    const poll = setInterval(refresh, 30_000);
    return () => clearInterval(poll);
  }, [hasActive, refresh]);

  const value = useMemo<DashboardData | null>(() => {
    if (!session || state.status !== "ready") return null;
    const today = new Date().toISOString().slice(0, 10);
    const meta = session.user.user_metadata ?? {};
    const displayName = (meta.full_name || meta.name || session.user.email?.split("@")[0] || "there") as string;
    return {
      session,
      profile: state.profile,
      connections: state.connections,
      drips: state.drips,
      notifications: state.notifications,
      wordsToday: state.profile.usage_date === today ? state.profile.words_used_today : 0,
      displayName,
      refresh,
      setProfile: (update) =>
        setState((s) => (s.status === "ready" ? { ...s, profile: { ...s.profile, ...update } } : s)),
      markRead: (id) => {
        const now = new Date().toISOString();
        supabase().from("notifications").update({ read_at: now }).eq("id", id).then(() => undefined);
        setState((s) =>
          s.status === "ready"
            ? { ...s, notifications: s.notifications.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)) }
            : s
        );
      },
      markAllRead: async () => {
        const unread = state.notifications.filter((n) => !n.read_at).map((n) => n.id);
        if (unread.length === 0) return;
        const now = new Date().toISOString();
        await supabase().from("notifications").update({ read_at: now }).in("id", unread);
        setState((s) =>
          s.status === "ready"
            ? { ...s, notifications: s.notifications.map((n) => (n.read_at ? n : { ...n, read_at: now })) }
            : s
        );
      },
    };
  }, [session, state, refresh]);

  return { session, state, value };
}

export const DashboardProvider = DashboardContext.Provider;

/** Starts the "Connect Google Docs" flow and returns to `returnPath`. */
export async function connectGoogleDocs(returnPath = "/app/connections"): Promise<void> {
  const redirect = encodeURIComponent(`${window.location.origin}${returnPath}`);
  const { url } = await api<{ url: string }>(`google-oauth-start?redirect_to=${redirect}`);
  window.location.assign(url);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatRelative(iso: string): string {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : formatDate(iso);
}

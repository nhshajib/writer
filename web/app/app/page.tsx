"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AgreementGate } from "@/components/dashboard/AgreementGate";
import { Connections } from "@/components/dashboard/Connections";
import { api } from "@/lib/api";
import { recordPendingAgreement } from "@/lib/googleAuth";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { type Connection, type Drip, STATUS_LABEL } from "@/lib/types";
import { useRequireSession } from "@/lib/useRequireSession";

export default function DashboardPage() {
  const session = useRequireSession();
  const [agreed, setAgreed] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [drips, setDrips] = useState<Drip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");

  const load = useCallback(async () => {
    try {
      const client = supabase();
      const [{ data: profile }, { data: conns }, list] = await Promise.all([
        client.from("profiles").select("agreed_terms_version, plan").maybeSingle(),
        client.from("provider_connections").select("id, provider, account_email"),
        api<{ drips: Drip[] }>("drips"),
      ]);
      // Someone who ticked the agreement before choosing Google has it recorded now.
      const agreedNow = profile?.agreed_terms_version === CURRENT_TERMS_VERSION || await recordPendingAgreement();
      setAgreed(agreedNow);
      setPlan(profile?.plan === "pro" ? "pro" : "free");
      setConnections((conns ?? []) as Connection[]);
      setDrips(list.drips);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your dashboard.");
    }
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  useEffect(() => {
    setGoogleStatus(new URLSearchParams(window.location.search).get("google"));
  }, []);

  if (!session) return <p role="status">Loading…</p>;
  if (error) return <p className="error" role="alert">{error}</p>;
  if (agreed === null || drips === null) return <p role="status">Loading your dashboard…</p>;
  if (!agreed) return <AgreementGate onAgreed={() => setAgreed(true)} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your dashboard</h1>
          <p className="muted" style={{ margin: "0.5rem 0 0" }}>
            {plan === "pro" ? <span className="pill pro">Pro</span> : <span className="pill">Free plan</span>}
          </p>
        </div>
      </div>

      {googleStatus === "connected" && (
        <p className="notice success" role="status">Your Google account is connected.</p>
      )}
      {googleStatus === "error" && (
        <p className="notice error" role="alert">We couldn't connect your Google account. Please try again.</p>
      )}

      <div className="stack">
        {plan === "free" && (
          <section className="upsell" aria-labelledby="upsell-title">
            <div>
              <h2 id="upsell-title">Writing something long?</h2>
              <p>Free includes 250 words a day. Pro gives you unlimited words, week-long sessions and 3 documents at once.</p>
            </div>
            <Link href="/pricing" className="button pro">Try Pro free for 7 days</Link>
          </section>
        )}
        <Connections connections={connections} />

        <section aria-labelledby="sessions-title">
          <h2 id="sessions-title">Your sessions</h2>
          {drips.length === 0
            ? <p className="muted">No sessions yet. When you start one, it appears here.</p>
            : (
              <ul className="session-list">
                {drips.map((drip) => (
                  <li key={drip.id} className="card">
                    <div className="session-head">
                      <h3>
                        <Link href={`/app/session?id=${drip.id}`}>{drip.document_title ?? "Untitled document"}</Link>
                      </h3>
                      <span className={`pill ${drip.status}`}>{STATUS_LABEL[drip.status]}</span>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={`Progress for ${drip.document_title ?? "this session"}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={drip.progress.percent}
                    >
                      <div className="progress-fill" style={{ width: `${drip.progress.percent}%` }} />
                    </div>
                    <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                      {drip.progress.words_written} of {drip.progress.words_total} words entered
                    </p>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </>
  );
}

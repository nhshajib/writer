"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Connection } from "@/lib/types";

export function Connections({ connections }: { connections: Connection[] }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const google = connections.filter((c) => c.provider === "google");

  async function connectGoogle() {
    setBusy(true);
    setError(null);
    try {
      const redirect = encodeURIComponent(`${window.location.origin}/app`);
      const { url } = await api<{ url: string }>(`google-oauth-start?redirect_to=${redirect}`);
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start connecting to Google.");
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="connections-title">
      <h2 id="connections-title" style={{ fontSize: "1.3rem" }}>Google account</h2>
      {google.length > 0
        ? (
          <p>
            Connected as <strong>{google.map((c) => c.account_email ?? "Google account").join(", ")}</strong>.
          </p>
        )
        : <p className="muted">Connect your Google account so TypeWit can create documents and add your text to them.</p>}
      <button type="button" className={google.length ? "button secondary small" : "button"} onClick={connectGoogle}
        disabled={busy}>
        {busy ? "Opening Google…" : google.length ? "Connect another account" : "Connect Google"}
      </button>
      {error && <p className="error" role="alert" style={{ marginTop: "0.75rem" }}>{error}</p>}
    </section>
  );
}

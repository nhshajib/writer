"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { ACTIVE_STATUSES, connectGoogleDocs, formatDate, formatRelative, useDashboard } from "@/lib/dashboard";
import type { Connection } from "@/lib/types";

interface DocSummary {
  key: string;
  title: string;
  url: string | null;
  account: string;
  connected: boolean;
  sessions: number;
  words: number;
  active: boolean;
  lastUsed: string;
}

export default function DocumentsPage() {
  const { connections, drips, refresh } = useDashboard();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const google = connections.filter((c) => c.provider === "google");

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("google");
    if (status === "connected") setNotice("Your Google account is connected.");
    if (status === "error") setError("We couldn't connect your Google account. Please try again.");
  }, []);

  const docs = useMemo(() => {
    const byKey = new Map<string, DocSummary>();
    for (const d of drips) {
      if (d.provider !== "google") continue;
      const key = `${d.connection_id}:${d.document_id}`;
      const conn = connections.find((c) => c.id === d.connection_id);
      const existing = byKey.get(key);
      if (existing) {
        existing.sessions += 1;
        existing.words += d.progress.words_written;
        existing.active ||= ACTIVE_STATUSES.has(d.status);
      } else {
        byKey.set(key, {
          key,
          title: d.document_title ?? "Untitled document",
          url: d.document_url,
          account: conn?.account_email ?? "Google account",
          connected: conn?.connected !== false,
          sessions: 1,
          words: d.progress.words_written,
          active: ACTIVE_STATUSES.has(d.status),
          lastUsed: d.created_at,
        });
      }
    }
    return [...byKey.values()];
  }, [drips, connections]);

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      await connectGoogleDocs("/app/documents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start connecting to Google.");
      setBusy(false);
    }
  }

  async function disconnect(conn: Connection) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api<{ stopped_sessions: number }>(`drips/connections/${conn.id}/disconnect`, { method: "POST", body: {} });
      setConfirming(null);
      await refresh();
      setNotice(
        `${conn.account_email ?? "Google account"} is disconnected.` +
          (res.stopped_sessions ? ` ${res.stopped_sessions} active session${res.stopped_sessions === 1 ? " was" : "s were"} stopped.` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't disconnect this account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Documents</h1>
          <p>Your Google accounts and the documents TypeWit has written into.</p>
        </div>
      </div>

      {notice && <p className="notice success" role="status">{notice}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}

      <section className="panel" aria-labelledby="accounts-title" style={{ marginBottom: "1.25rem" }}>
        <div className="panel-head">
          <h2 id="accounts-title">Google accounts</h2>
          {google.length > 0 && (
            <button type="button" className="button quiet small" onClick={connect} disabled={busy}>Connect another</button>
          )}
        </div>
        {google.length === 0
          ? (
            <div className="empty">
              <span className="icon-badge"><Icon.doc /></span>
              <p>Connect Google so TypeWit can create documents and add your approved text to them.</p>
              <button type="button" className="button" onClick={connect} disabled={busy}>
                {busy ? "Opening Google…" : "Connect Google Docs"}
              </button>
            </div>
          )
          : (
            <ul className="row-list">
              {google.map((conn) => {
                const live = conn.connected !== false;
                return (
                  <li key={conn.id}>
                    <div className="row">
                      <div className="grow">
                        <strong>{conn.account_email ?? "Google account"}</strong>
                        <div className="row-sub">
                          <span className={live ? "status-dot" : "status-dot off"}>{live ? "Connected" : "Disconnected"}</span>
                          {conn.created_at && <> · added {formatDate(conn.created_at)}</>}
                        </div>
                      </div>
                      {live
                        ? (
                          <button type="button" className="button danger small" onClick={() => setConfirming(conn.id)} disabled={busy}>
                            Disconnect
                          </button>
                        )
                        : <button type="button" className="button small" onClick={connect} disabled={busy}>Reconnect</button>}
                    </div>
                    {confirming === conn.id && (
                      <div className="confirm" role="alertdialog" aria-labelledby={`dc-${conn.id}`} aria-describedby={`dcd-${conn.id}`}>
                        <p id={`dc-${conn.id}`} style={{ fontWeight: 650, margin: "0 0 0.25rem" }}>Disconnect {conn.account_email}?</p>
                        <p id={`dcd-${conn.id}`} className="muted">
                          TypeWit loses access to this Google account and any active sessions on it stop. Your documents
                          and history stay. You can reconnect at any time.
                        </p>
                        <div className="controls" style={{ marginTop: "0.5rem" }}>
                          <button type="button" className="button danger small" onClick={() => disconnect(conn)} disabled={busy} autoFocus>
                            {busy ? "Disconnecting…" : "Disconnect"}
                          </button>
                          <button type="button" className="button quiet small" onClick={() => setConfirming(null)}>Keep connected</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        <p className="fine-print" style={{ marginBottom: 0 }}>
          TypeWit can only open documents it creates for you. It can't see anything else in your Drive.
        </p>
      </section>

      <section aria-labelledby="docs-title">
        <h2 id="docs-title" style={{ fontSize: "1.15rem", marginBottom: "1rem" }}>Your documents</h2>
        {docs.length === 0
          ? (
            <div className="panel empty">
              <span className="icon-badge"><Icon.doc /></span>
              <p>Documents appear here after your first session.</p>
              <Link href="/app/new" className="button small">Start a session</Link>
            </div>
          )
          : (
            <ul className="doc-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {docs.map((doc) => (
                <li key={doc.key} className="panel doc-card">
                  <span className="icon-badge" style={{ marginBottom: "0.25rem" }}><Icon.doc /></span>
                  <h3>{doc.title}</h3>
                  <p className="row-sub" style={{ margin: 0 }}>
                    {doc.sessions} session{doc.sessions === 1 ? "" : "s"} · {doc.words.toLocaleString()} words · {formatRelative(doc.lastUsed)}
                  </p>
                  <p className="row-sub" style={{ margin: 0 }}>{doc.account}{doc.active && " · in progress"}</p>
                  <div className="actions-row">
                    {doc.url && (
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="button quiet small">
                        Open <Icon.external /><span className="sr-only">{doc.title} in Google Docs (opens in a new tab)</span>
                      </a>
                    )}
                    {doc.connected && (
                      <Link href={`/app/new?doc=${encodeURIComponent(doc.key)}`} className="button small">
                        Add text<span className="sr-only"> to {doc.title}</span>
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>
    </>
  );
}

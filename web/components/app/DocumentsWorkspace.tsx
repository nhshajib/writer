"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { ACTIVE_STATUSES, connectGoogleDocs, formatDate, formatRelative, useDashboard } from "@/lib/dashboard";
import type { Connection } from "@/lib/types";

interface DocSummary {
  key: string;
  provider: "google" | "microsoft";
  title: string;
  url: string | null;
  account: string;
  connected: boolean;
  sessions: number;
  words: number;
  active: boolean;
  lastUsed: string;
}

export function DocumentsWorkspace({ accountsOnly = false }: { accountsOnly?: boolean }) {
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
      if (d.provider !== "google" && d.provider !== "microsoft") continue;
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
          provider: d.provider,
          title: d.document_title ?? "Untitled document",
          url: d.document_url,
          account: d.provider === "microsoft" ? "Microsoft Word" : conn?.account_email ?? "Google account",
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
      await connectGoogleDocs("/app/connections");
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
      <div className="page-head">
        <div>
          <h1>{accountsOnly ? "Connected accounts" : "Documents"}</h1>
          <p>{accountsOnly ? "Connect or disconnect the Google accounts you use for document sessions." : "Your session documents. Choose an existing document or create a new one when starting a session."}</p>
        </div>
        {accountsOnly && google.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={connect} disabled={busy}>Connect another account</button>}
      </div>

      {notice && <p className="alert alert-success mb-5" role="status">{notice}</p>}
      {error && <p className="alert alert-error mb-5" role="alert">{error}</p>}

      {accountsOnly ? <div className="connections mb-6">
      <section className="card card-flush" aria-labelledby="accounts-title">
        <div className="card-head">
          <h2 id="accounts-title" className="with-icon"><span className="doc-icon sm gdoc" aria-hidden="true"><Icon.doc /></span>Google Docs</h2>
        </div>
        {google.length === 0
          ? (
            <div className="empty">
              <div className="icon"><Icon.doc /></div>
              <h3>Connect Google Docs</h3>
              <p>TypeWit can then create documents and add your approved text. It can&apos;t see anything else in your Drive.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={connect} disabled={busy}>{busy ? "Opening Google…" : "Connect Google"}</button>
            </div>
          )
          : (
            <ul className="list">
              {google.map((conn) => {
                const live = conn.connected !== false;
                return (
                  <li key={conn.id}>
                    <div className="list-item">
                      <span className="avatar" aria-hidden="true">{(conn.account_email ?? "G").charAt(0).toUpperCase()}</span>
                      <div className="main">
                        <span className="title">{conn.account_email ?? "Google account"}</span>
                        <div className="meta">{conn.created_at ? `Added ${formatDate(conn.created_at)}` : "Google Docs"}</div>
                      </div>
                      <span className={`badge ${live ? "badge-green" : "badge-red"}`}><span className="dot" aria-hidden="true" />{live ? "Connected" : "Disconnected"}</span>
                      {live
                        ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(conn.id)} disabled={busy}>Disconnect</button>
                        : <button type="button" className="btn btn-secondary btn-sm" onClick={connect} disabled={busy}>Reconnect</button>}
                    </div>
                    {confirming === conn.id && (
                      <div className="confirm" role="alertdialog" aria-labelledby={`dc-${conn.id}`} aria-describedby={`dcd-${conn.id}`} style={{ margin: "0 1.25rem 1.25rem" }}>
                        <p id={`dc-${conn.id}`}>Disconnect {conn.account_email}?</p>
                        <p id={`dcd-${conn.id}`} className="small muted">
                          TypeWit loses access and any active sessions on this account stop. Your documents and history stay.
                        </p>
                        <div className="row">
                          <button type="button" className="btn btn-danger-solid btn-sm" onClick={() => disconnect(conn)} disabled={busy} autoFocus>
                            {busy ? "Disconnecting…" : "Disconnect"}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      <section className="card" id="word" aria-labelledby="word-title">
        <h2 id="word-title" className="with-icon mb-3"><span className="doc-icon sm word" aria-hidden="true"><Icon.doc /></span>Microsoft Word</h2>
        <p className="small muted">
          In Word, TypeWit runs as an add-in: a panel beside your document that enters your approved text into that
          document, at the pace you set. It can only change the document it is open in, and TypeWit stores no Microsoft
          password or token.
        </p>
        <details className="more">
        <summary>How to add TypeWit to Word</summary>
        <ol className="small" style={{ paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>Download the add-in file: <a href="/word/manifest.xml" download="typewit-word-manifest.xml">typewit-word-manifest.xml</a>.</li>
          <li>
            In Word on the web, open a document saved in OneDrive or SharePoint, choose <strong>Home → Add-ins → More
            add-ins → My add-ins → Upload my add-in</strong>, and choose the file. (Word for Windows or Mac: your
            organization&apos;s admin can deploy the same file, or see Microsoft&apos;s guide to sideloading add-ins.)
          </li>
          <li>Open <strong>TypeWit</strong> from Add-ins, sign in with your TypeWit email and password, and start a session.</li>
        </ol>
        </details>
        <p className="hint">
          Word sessions run only while the document and the TypeWit panel are open. If you close them, nothing is entered
          and the rest of the schedule moves later when you come back. Word sessions start inside Word, not from this
          website or a phone browser; pause, resume and stop also work from here.
        </p>
      </section>
      </div> : <p className="mb-5"><Link href="/app/connections/">Manage connected Google accounts →</Link></p>}

      {!accountsOnly && <section aria-labelledby="docs-title">
        <h2 id="docs-title" className="section-title mb-3">Documents</h2>
        {docs.length === 0
          ? (
            <div className="card empty">
              <h3>No documents yet</h3>
              <p>Documents appear here after your first session.</p>
              <Link href="/app/new" className="btn btn-primary btn-sm"><Icon.plus /> New session</Link>
            </div>
          )
          : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th scope="col">Title</th><th scope="col">Account</th><th scope="col">Sessions</th><th scope="col">Last used</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.key}>
                      <td>
                        <div className="doc-cell">
                          <span className={`doc-icon sm ${doc.provider === "microsoft" ? "word" : "gdoc"}`} aria-hidden="true"><Icon.doc /></span>
                          <div>
                            <span className="title">{doc.title}</span>
                            {doc.active && <div className="small accent">In progress</div>}
                          </div>
                        </div>
                      </td>
                      <td className="num hide-sm" data-label="Account">{doc.account}</td>
                      <td className="num" data-label="Sessions">{doc.sessions} · {doc.words.toLocaleString()} words</td>
                      <td className="num" data-label="Last used">{formatRelative(doc.lastUsed)}</td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end", gap: "0.25rem", flexWrap: "nowrap" }}>
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                              Open<span className="sr-only"> {doc.title} in {doc.provider === "microsoft" ? "Word" : "Google Docs"} (opens in a new tab)</span> <Icon.external />
                            </a>
                          )}
                          {doc.connected && doc.provider === "google" && (
                            <Link href={`/app/new?doc=${encodeURIComponent(doc.key)}`} className="btn btn-secondary btn-sm">
                              Add text<span className="sr-only"> to {doc.title}</span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>}
    </>
  );
}

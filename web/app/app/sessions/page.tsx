"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SessionRow } from "@/components/app/SessionRow";
import { Icon } from "@/components/Icons";
import { useDashboard } from "@/lib/dashboard";
import { type Drip, STATUS_LABEL } from "@/lib/types";

type Filter = "all" | "active" | "paused" | "completed" | "stopped";

const FILTERS: { key: Filter; label: string; match: (d: Drip) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "In progress", match: (d) => d.status === "scheduled" || d.status === "running" },
  { key: "paused", label: "Paused", match: (d) => d.status === "paused" },
  { key: "completed", label: "Finished", match: (d) => d.status === "completed" },
  { key: "stopped", label: "Stopped", match: (d) => d.status === "canceled" || d.status === "failed" },
];

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function SessionsPage() {
  const { drips } = useDashboard();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const match = FILTERS.find((f) => f.key === filter)!.match;
    const q = query.trim().toLowerCase();
    return drips.filter((d) => match(d) && (!q || (d.document_title ?? "").toLowerCase().includes(q)));
  }, [drips, filter, query]);

  function exportCsv() {
    const rows = [
      ["Document", "Status", "Words entered", "Words total", "Started", "Document link"],
      ...drips.map((d) => [
        d.document_title ?? "Untitled document",
        STATUS_LABEL[d.status],
        d.progress.words_written,
        d.progress.words_total,
        new Date(d.created_at).toISOString(),
        d.document_url ?? "",
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "typewit-sessions.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Sessions</h1>
          <p>Everything you've asked TypeWit to enter, newest first.</p>
        </div>
        <Link href="/app/new" className="button"><Icon.plus /> New session</Link>
      </div>

      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Filter sessions" style={{ margin: 0 }}>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}<span className="count">{drips.filter(f.match).length}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <label htmlFor="search" className="sr-only">Search by document title</label>
          <input id="search" type="search" placeholder="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className="button quiet small" onClick={exportCsv} disabled={drips.length === 0}>Export CSV</button>
        </div>
      </div>

      <section className="panel" aria-label="Session list">
        <p className="sr-only" role="status">{visible.length} sessions shown</p>
        {visible.length === 0
          ? (
            <div className="empty">
              <span className="icon-badge"><Icon.list /></span>
              <p>{drips.length === 0 ? "No sessions yet." : "No sessions match."}</p>
              {drips.length === 0 && <Link href="/app/new" className="button small">Start your first session</Link>}
            </div>
          )
          : <ul className="row-list">{visible.map((d) => <li key={d.id}><SessionRow drip={d} /></li>)}</ul>}
      </section>
      {drips.length >= 100 && <p className="fine-print">Showing your 100 most recent sessions.</p>}
    </>
  );
}

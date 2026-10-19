"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/app/StatusBadge";
import { Icon } from "@/components/Icons";
import { api } from "@/lib/api";
import { formatRelative, useDashboard } from "@/lib/dashboard";
import { type Drip, STATE_LABEL, stateOf, UNIT_LABEL } from "@/lib/types";

type Filter = "all" | "active" | "done" | "stopped";
type Sort = "newest" | "oldest" | "title";

const FILTERS: { key: Filter; label: string; match: (d: Drip) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "Active", match: (d) => ["scheduled", "running", "paused"].includes(d.status) },
  { key: "done", label: "Finished", match: (d) => d.status === "completed" },
  { key: "stopped", label: "Stopped", match: (d) => d.status === "canceled" || d.status === "failed" },
];


const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export default function SessionsPage() {
  const dashboard = useDashboard();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [query, setQuery] = useState("");
  // The dashboard holds the newest 100 sessions; older ones load on request.
  const [older, setOlder] = useState<Drip[]>([]);
  const [hasMore, setHasMore] = useState(dashboard.drips.length >= 100);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const drips = useMemo(() => {
    const seen = new Set(dashboard.drips.map((d) => d.id));
    return [...dashboard.drips, ...older.filter((d) => !seen.has(d.id))];
  }, [dashboard.drips, older]);

  const visible = useMemo(() => {
    const match = FILTERS.find((f) => f.key === filter)!.match;
    const q = query.trim().toLowerCase();
    const list = drips.filter((d) => match(d) && (!q || (d.document_title ?? "").toLowerCase().includes(q)));
    if (sort === "oldest") return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sort === "title") {
      return [...list].sort((a, b) => (a.document_title ?? "").localeCompare(b.document_title ?? "", undefined, { sensitivity: "base" }));
    }
    return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [drips, filter, query, sort]);

  async function loadMore() {
    const oldest = drips.reduce((min, d) => (d.created_at < min ? d.created_at : min), drips[0]?.created_at ?? "");
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await api<{ drips: Drip[]; has_more?: boolean }>(`drips?before=${encodeURIComponent(oldest)}`);
      setOlder((prev) => [...prev, ...res.drips]);
      setHasMore(Boolean(res.has_more));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load more sessions.");
    } finally {
      setLoadingMore(false);
    }
  }

  // Exports what the list shows: the current filter, search and order.
  function exportCsv() {
    const rows = [
      ["Document", "Status", "Words entered", "Words total", "Started", "Document link"],
      ...visible.map((d) => [d.document_title ?? "Untitled document", STATE_LABEL[stateOf(d)], d.progress.words_written,
        d.progress.words_total, new Date(d.created_at).toISOString(), d.document_url ?? ""]),
    ];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" }));
    link.download = filter === "all" && !query.trim() ? "typewit-sessions.csv" : `typewit-sessions-${filter}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const index = FILTERS.findIndex((f) => f.key === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sessions</h1>
          <p>Everything you&apos;ve asked TypeWit to enter.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={visible.length === 0}>
          Export CSV{visible.length !== drips.length ? ` (${visible.length} shown)` : ""}
        </button>
      </div>

      {drips.length === 0
        ? (
          <div className="card empty">
            <div className="icon"><Icon.list /></div>
            <h3>No sessions yet</h3>
            <p>Start a session to see its progress here.</p>
            <Link href="/app/new" className="btn btn-primary btn-sm"><Icon.plus /> New session</Link>
          </div>
        )
        : (
          <>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
              <div className="seg" role="group" aria-label="Filter sessions" style={{ "--n": FILTERS.length, "--i": index } as React.CSSProperties}>
                {FILTERS.map((f) => (
                  <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                    {f.label} <span className="muted">{drips.filter(f.match).length}</span>
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: "0.5rem", flexWrap: "nowrap", width: "min(440px, 100%)" }}>
                <label htmlFor="search" className="sr-only">Search by document title</label>
                <input id="search" type="search" placeholder="Search documents" value={query} onChange={(e) => setQuery(e.target.value)} />
                <label htmlFor="sort" className="sr-only">Sort sessions</label>
                <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: "auto" }}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Document A–Z</option>
                </select>
              </div>
            </div>
            <p className="sr-only" role="status">{visible.length} sessions shown</p>

            <div className="table-wrap">
              {visible.length === 0
                ? <div className="empty"><p>No sessions match.</p></div>
                : (
                  <table className="table">
                    <thead>
                      <tr><th scope="col">Document</th><th scope="col">Status</th><th scope="col">Progress</th><th scope="col">Words</th><th scope="col">Started</th></tr>
                    </thead>
                    <tbody>
                      {visible.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <Link href={`/app/session?id=${d.id}`} className="title">{d.document_title ?? "Untitled document"}</Link>
                            <div className="small muted">{d.mode === "as_soon_as_possible" ? "All at once" : UNIT_LABEL[d.insertion_unit].title}</div>
                          </td>
                          <td><StatusBadge state={stateOf(d)} /></td>
                          <td className="hide-sm">
                            <div className="progress" aria-hidden="true"><span style={{ width: `${d.progress.percent}%` }} /></div>
                          </td>
                          <td className="num">{d.progress.words_written} / {d.progress.words_total}</td>
                          <td className="num">{formatRelative(d.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
            {hasMore && (
              <div className="row" style={{ marginTop: "0.75rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load older sessions"}
                </button>
                <span className="hint">Showing {drips.length} sessions. Filters and search apply to the ones loaded.</span>
              </div>
            )}
            {loadError && <p className="alert alert-error" role="alert" style={{ marginTop: "0.5rem" }}>{loadError}</p>}
          </>
        )}
    </>
  );
}

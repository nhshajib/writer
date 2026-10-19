import type { AccessReport } from "@/lib/types";

/** The result of Test connection, as a list that says each outcome in words. */
export function ConnectionReport({ report }: { report: AccessReport }) {
  return (
    <div className={`alert ${report.ok ? "alert-success" : "alert-error"}`} style={{ display: "block", marginTop: "0.75rem" }}>
      <p><strong>{report.ok ? "Connection works." : "Connection problem."}</strong> {report.ok ? "Nothing in the document was changed." : report.message}</p>
      <ul className="check-list">
        {report.checks.map((c) => (
          <li key={c.key}>
            <span className="check-mark" aria-hidden="true">{c.ok === true ? "✓" : c.ok === false ? "✗" : "–"}</span>
            <span><strong>{c.label}:</strong> {c.ok === true ? "OK. " : c.ok === false ? "Failed. " : ""}{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

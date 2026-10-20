import type { AccessReport } from "@/lib/types";

/** The result of Test connection, as a list that says each outcome in words. */
export function ConnectionReport({ report, children }: { report: AccessReport; children?: React.ReactNode }) {
  return (
    <div className={`alert ${report.ok ? "alert-success" : "alert-error"}`} style={{ display: "block", marginTop: "0.75rem" }}>
      <p><strong>{report.ok ? "Connection works." : "Connection problem."}</strong> {report.ok ? report.message.replace(/^Connection works\.\s*/, "") : report.message}</p>
      <ul className="check-list">
        {report.checks.map((c) => (
          <li key={c.key}>
            <span className="check-mark" aria-hidden="true">{c.ok === true ? "✓" : c.ok === false ? "✗" : "–"}</span>
            <span><strong>{c.label}:</strong> {c.ok === true ? "OK. " : c.ok === false ? "Failed. " : ""}{c.detail}</span>
          </li>
        ))}
      </ul>
      {report.location && <WhatChanged location={report.location} />}
      {children}
    </div>
  );
}

/**
 * Side by side: how TypeWit expected the document to end, and how it ends now.
 * Line breaks are shown as ¶ so blank lines and trailing spaces can be seen.
 */
export function WhatChanged({ location }: { location: NonNullable<AccessReport["location"]> }) {
  return (
    <div className="what-changed">
      <p className="small" style={{ marginTop: "0.75rem" }}>
        TypeWit only adds text at the very end of the document, right after the text it entered. Anything typed, pasted or
        deleted after that point (even a space or a blank line) makes it stop, so it never writes in the
        wrong place.
      </p>
      <div className="what-changed-grid">
        <figure>
          <figcaption>TypeWit expected the document to end with</figcaption>
          <pre className="preview" tabIndex={0}>{visible(location.expected_end)}</pre>
        </figure>
        <figure>
          <figcaption>Your document ends with</figcaption>
          <pre className="preview" tabIndex={0}>{visible(location.document_end)}</pre>
        </figure>
      </div>
      <p className="small">
        To fix it, either undo or remove what comes after TypeWit&apos;s text and choose <strong>I&apos;ve fixed it: check
        and resume</strong>, or keep the document as it is and choose <strong>Continue after the document&apos;s current
        end</strong>.
      </p>
    </div>
  );
}

/** Makes line breaks and trailing spaces visible; long ends start with an ellipsis. */
function visible(text: string): string {
  const shown = text.replace(/ +$/gm, (m) => "·".repeat(m.length)).replace(/\n/g, "¶\n");
  return text.length >= 160 ? `…${shown}` : shown || "(empty)";
}

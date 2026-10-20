"use client";

import { type ReactNode, useRef } from "react";
import { Agreement } from "@/components/Agreement";
import { Icon } from "@/components/Icons";
import { PrivacyBody } from "@/components/legal/Privacy";
import { TermsBody } from "@/components/legal/Terms";
import { LEGAL_UPDATED } from "@/lib/site";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export type LegalDoc = "terms" | "privacy" | "agreement";

const DOCS: Record<LegalDoc, { title: string; note: string; body: () => ReactNode }> = {
  terms: { title: "Terms of Service", note: `Last updated ${LEGAL_UPDATED}`, body: () => <TermsBody /> },
  privacy: { title: "Privacy Policy", note: `Last updated ${LEGAL_UPDATED}`, body: () => <PrivacyBody /> },
  agreement: {
    title: "Responsible Use Agreement",
    note: `Version ${CURRENT_TERMS_VERSION}. Everyone agrees to this before using TypeWit.`,
    body: () => <Agreement headingLevel={3} />,
  },
};

/**
 * A button that opens a policy in a dialog, so reading it doesn't leave the
 * page. `onAgree` adds an "I agree" button (used for the Responsible Use Agreement).
 */
export function LegalDialog({ doc, children, className = "link-btn inline", onAgree }: {
  doc: LegalDoc;
  children: ReactNode;
  className?: string;
  onAgree?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { title, note, body } = DOCS[doc];
  const titleId = `legal-${doc}-title`;
  return (
    <>
      <button type="button" className={className} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">{children}</button>
      <dialog ref={dialog} className="agreement-dialog" aria-labelledby={titleId}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="agreement-dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p className="small muted">{note}</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} autoFocus>
            <Icon.close /><span className="sr-only">Close</span>
          </button>
        </div>
        <div className={`agreement-dialog-body${doc === "agreement" ? "" : " legal"}`} tabIndex={0} role="region" aria-label={title}>{body()}</div>
        <div className="agreement-dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>Close</button>
          {onAgree && <button type="button" className="btn btn-primary" onClick={() => { onAgree(); dialog.current?.close(); }}>I agree</button>}
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useRef } from "react";
import { Agreement } from "@/components/Agreement";
import { Icon } from "@/components/Icons";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

/** "Read it": the Responsible Use Agreement in a dialog, with a button to agree from there. */
export function AgreementDialog({ onAgree }: { onAgree: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="link-btn inline" onClick={() => dialog.current?.showModal()}>Read it</button>
      <dialog ref={dialog} className="agreement-dialog" aria-labelledby="agreement-dialog-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="agreement-dialog-head">
          <div>
            <h2 id="agreement-dialog-title">Responsible Use Agreement</h2>
            <p className="small muted">Version {CURRENT_TERMS_VERSION}. Everyone agrees to this before using TypeWit.</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} autoFocus>
            <Icon.close /><span className="sr-only">Close</span>
          </button>
        </div>
        <div className="agreement-dialog-body prose-sm">
          <Agreement headingLevel={3} />
        </div>
        <div className="agreement-dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => { onAgree(); dialog.current?.close(); }}>I agree</button>
        </div>
      </dialog>
    </>
  );
}

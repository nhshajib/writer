"use client";

import { useState } from "react";
import { Agreement } from "@/components/Agreement";
import { supabase } from "@/lib/supabase";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

/** Shown when the account hasn't accepted the current Responsible Use Agreement. */
export function AgreementGate({ onAgreed }: { onAgreed: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase().rpc("agree_to_terms", { version: CURRENT_TERMS_VERSION });
    setBusy(false);
    if (rpcError) setError(rpcError.message);
    else onAgreed();
  }

  return (
    <main id="main" className="auth" tabIndex={-1}>
      <section className="auth-box wide" aria-labelledby="gate-title">
        <h1 id="gate-title">One last step</h1>
        <p className="sub">Please read and accept the Responsible Use Agreement to continue.</p>
        <div className="auth-form">
          <Agreement id="gate-agreement" compact headingLevel={2} />
          <label className="check" htmlFor="gate-agree">
            <input id="gate-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I&apos;ve read the Responsible Use Agreement and agree to follow it.</span>
          </label>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!agreed || busy} onClick={confirm}>
            {busy ? "Saving…" : "Agree and continue"}
          </button>
        </div>
      </section>
    </main>
  );
}

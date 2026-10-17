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
    <section className="form" aria-labelledby="gate-title" style={{ maxWidth: 640 }}>
      <h1 id="gate-title">Responsible Use Agreement</h1>
      <p>Please read and accept the agreement to continue.</p>
      <Agreement id="gate-agreement" compact headingLevel={2} />
      <label className="choice" htmlFor="gate-agree">
        <input id="gate-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I have read the Responsible Use Agreement and agree to follow it.</span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="button" disabled={!agreed || busy} onClick={confirm}>
        {busy ? "Saving…" : "Agree and continue"}
      </button>
    </section>
  );
}

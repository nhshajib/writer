"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";
import { Logo } from "@/components/Logo";

/**
 * An example session: a document receiving text, with TypeWit's progress card over it. Clearly
 * marked as a preview; Pause only changes this example, so visitors can see what the control does.
 */
export function LivePreview() {
  const [paused, setPaused] = useState(false);
  return (
    <figure className="lp-demo" data-paused={paused || undefined} aria-labelledby="preview-caption">
      <figcaption id="preview-caption" className="sr-only">Preview · an example session</figcaption>
      <div className="lp-doc" aria-hidden="true">
        <div className="lp-doc-bar">
          <span className="lp-doc-mark"><Icon.doc /></span>
          <span className="lp-doc-name">Research notes</span>
          <span className="lp-doc-dots"><i /><i /><i /></span>
        </div>
        <div className="lp-doc-page">
          <p className="lp-doc-h">Access to care</p>
          <p>
            Rural communities face unique challenges in accessing healthcare<span className="lp-doc-detail">, including distance, transportation and
            limited specialist availability</span>. <span className="lp-arriving">Telehealth can help reduce these barriers<span className="lp-doc-detail">
            and increase access to care</span>.</span><span className="lp-caret" />
          </p>
          <span className="lp-line" /><span className="lp-line short" />
        </div>
      </div>
      <div className="lp-card">
        <div className="lp-card-head">
          <Logo className="lp-card-logo" />
          <strong>Example session</strong>
          <span className={`lp-state${paused ? " paused" : ""}`} aria-live="polite"><i aria-hidden="true" />{paused ? "Paused" : "Running"}</span>
        </div>
        <div className="lp-progress" role="progressbar" aria-label="Example session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={62}>
          <span style={{ width: "62%" }} />
        </div>
        <p className="lp-card-meta"><span>248 of 400 words</span><span>{paused ? "Paused" : "Finishes in 22 min"}</span></p>
        <button type="button" className="lp-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
          {paused ? <Icon.play /> : <Icon.pause />}{paused ? "Resume" : "Pause"}<span className="sr-only"> the example session</span>
        </button>
      </div>
    </figure>
  );
}

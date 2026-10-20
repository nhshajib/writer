"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";
import { Logo } from "@/components/Logo";

/**
 * An example TypeWit session beside a document. Clearly marked as a preview; the Pause button only
 * changes this example, so visitors can see what the control does.
 */
export function LivePreview() {
  const [paused, setPaused] = useState(false);
  return (
    <figure className="mk-preview" aria-labelledby="preview-caption">
      <figcaption id="preview-caption" className="mk-preview-tag"><span aria-hidden="true">●</span> Preview · an example session</figcaption>
      <div className="mk-demo" data-paused={paused || undefined}>
        <div className="mk-doc" aria-hidden="true">
          <div className="mk-doc-head">
            <span className="mk-doc-mark"><Icon.doc /></span>
            <div>
              <strong>Research notes</strong>
              <span className="mk-menu"><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Tools</span><span>Help</span></span>
            </div>
          </div>
          <div className="mk-toolbar">
            <span>↶</span><span>↷</span><span className="mk-field">Normal text ▾</span><span className="mk-field">Inter ▾</span><span className="mk-field">11 ▾</span>
            <b>B</b><i>I</i><u>U</u>
          </div>
          <div className="mk-page">
            <p>
              Rural communities face unique challenges in accessing healthcare, including distance, transportation and
              limited specialist availability. <span className="arriving">Telehealth can help reduce these barriers and
              increase access to care.</span><span className="caret" />
            </p>
          </div>
        </div>
        <div className="mk-panel">
          <div className="mk-panel-head" aria-hidden="true"><Logo className="mk-logo" /><strong>TypeWit</strong><span className="mk-dots">···</span></div>
          <div className="mk-row"><span>Session progress</span><span>248 / 400 words</span></div>
          <div className="mk-bar" role="progressbar" aria-label="Example session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={62}>
            <span style={{ width: "62%" }}>62%</span>
          </div>
          <div className="mk-status" aria-live="polite">
            <span className={`mk-running${paused ? " paused" : ""}`}><i aria-hidden="true" />{paused ? "Paused" : "Running"}</span>
            <span>Automated text entry into your document.</span>
          </div>
          <button type="button" className="mk-pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? <Icon.play /> : <Icon.pause />}{paused ? "Resume" : "Pause"}<span className="sr-only"> the example session</span>
          </button>
          <div className="mk-row mk-last" aria-hidden="true"><span>Finish in</span><span className="mk-select">1 hour ▾</span></div>
        </div>
      </div>
    </figure>
  );
}

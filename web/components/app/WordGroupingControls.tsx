"use client";

/** A basic entry choice, available on every plan and shared with the Word pane. */
export function WordGroupingControls({ value, onChange }: {
  value: "random" | "single";
  onChange: (value: "random" | "single") => void;
}) {
  return (
    <fieldset className="word-grouping">
      <legend>How words arrive</legend>
      <div className="word-grouping-options">
        <label className="choice">
          <input type="radio" name="word-grouping" value="random" checked={value === "random"} onChange={() => onChange("random")} />
          <span><strong>Random word groups</strong><small>1–5 words per step. Recommended for a varied rhythm.</small></span>
        </label>
        <label className="choice">
          <input type="radio" name="word-grouping" value="single" checked={value === "single"} onChange={() => onChange("single")} />
          <span><strong>One word at a time</strong><small>Each word arrives separately. May need a longer session.</small></span>
        </label>
      </div>
      <p className="hint">Both preserve your text and spacing. Each edit stays at least 4 seconds apart; the preview checks whether your duration fits.</p>
    </fieldset>
  );
}

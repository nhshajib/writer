"use client";

import { type ReactNode, useId, useRef, useState } from "react";

/** Tabs with arrow-key movement. Panels stay mounted unless an expensive preview opts into lazy loading. */
export function Tabs({ label, tabs, initial = 0 }: { label: string; tabs: { title: ReactNode; content: ReactNode; lazy?: boolean }[]; initial?: number }) {
  const [current, setCurrent] = useState(initial);
  const id = useId();
  const list = useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (current === last ? 0 : current + 1)
      : e.key === "ArrowLeft" ? (current === 0 ? last : current - 1)
      : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    setCurrent(next);
    list.current?.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
  }

  return (
    <div className="tabs">
      <div ref={list} role="tablist" aria-label={label} className="tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button key={i} type="button" role="tab" id={`${id}-tab-${i}`} aria-selected={i === current} aria-controls={`${id}-panel-${i}`}
            tabIndex={i === current ? 0 : -1} onClick={() => setCurrent(i)}>
            {tab.title}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={i} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={i !== current} className="tabpanel">
          {(!tab.lazy || i === current) && tab.content}
        </div>
      ))}
    </div>
  );
}

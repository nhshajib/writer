"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/**
 * A button that shows a small panel under it (a disclosure). Escape or a click
 * outside closes it and returns focus to the button. `children` gets `close`
 * so items can close the panel after acting.
 */
export function Popover({ label, button, buttonClass = "icon-btn", align = "end", side = "bottom", panelClass = "", children }: {
  /** Accessible name of the button. */
  label: string;
  /** What the button shows (an icon, or icon and text). */
  button: ReactNode;
  buttonClass?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  panelClass?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>(".popover-panel a[href], .popover-panel button:not([disabled]), .popover-panel input")?.focus();
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div className="popover" ref={root}>
      <button ref={trigger} type="button" className={buttonClass} aria-expanded={open} aria-controls={id} aria-label={label}
        onClick={() => setOpen((o) => !o)}>
        {button}
      </button>
      <div id={id} className={`popover-panel ${panelClass}`} data-align={align} data-side={side} hidden={!open}>
        {open && children(close)}
      </div>
    </div>
  );
}

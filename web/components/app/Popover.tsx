"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Sheet } from "@/components/app/mobile/Sheet";
import { useIsMobile } from "@/lib/useMediaQuery";

/**
 * A button that shows a small panel under it (a disclosure). Escape or a click
 * outside closes it and returns focus to the button. `children` gets `close`
 * so items can close the panel after acting.
 */
export function Popover({ label, title, button, buttonClass = "icon-btn", align = "end", side = "bottom", panelClass = "", children }: {
  /** Accessible name of the button. */
  label: string;
  /** Heading when shown as a bottom sheet on phones (defaults to the label). */
  title?: string;
  /** What the button shows (an icon, or icon and text). */
  button: ReactNode;
  buttonClass?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  panelClass?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || mobile) return;
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
  }, [open, mobile]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  // Phones: the same content as a bottom sheet, with the page behind made inert.
  if (mobile) {
    return (
      <>
        <button ref={trigger} type="button" className={buttonClass} aria-haspopup="dialog" aria-label={label} onClick={() => setOpen(true)}>
          {button}
        </button>
        <Sheet open={open} onClose={() => setOpen(false)} title={title ?? label} className={panelClass}>
          {children(() => setOpen(false))}
        </Sheet>
      </>
    );
  }

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

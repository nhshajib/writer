"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { Icon } from "@/components/Icons";

/**
 * A bottom sheet for short choices, menus and previews on phones. Built on
 * <dialog>: focus stays inside, the page behind is inert, Escape closes it and
 * focus returns to the button that opened it.
 */
export function Sheet({ open, onClose, title, children, dismissible = true, className = "" }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** False for sheets holding unsaved choices: then only the close button and Escape close it, not a tap outside. */
  dismissible?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`sheet ${className}`} aria-labelledby={titleId} onClose={onClose}
      onClick={(e) => dismissible && e.target === ref.current && ref.current?.close()}>
      <div className="sheet-inner">
        <span className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()}>
            <Icon.close /><span className="sr-only">Close</span>
          </button>
        </div>
        <div className="sheet-body">{open && children}</div>
      </div>
    </dialog>
  );
}

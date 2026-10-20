"use client";

import { type ReactNode, useId, useState } from "react";

/**
 * A list that shows its first items on phones, with a button for the rest. Every item stays in the
 * page (hidden with CSS on phones only), so search engines and larger screens see the whole list.
 */
export function MoreList({ className, shown, total, label, children }: {
  className: string;
  shown: number;
  total: number;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <ul id={id} className={className} data-collapsed={open ? undefined : shown}>{children}</ul>
      <button type="button" className="mk-more mobile-only" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {open ? "Show fewer" : `Show all ${total} ${label}`}
      </button>
    </>
  );
}

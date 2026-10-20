import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icons";

/** A titled group of rows, like an iPhone settings section. */
export function Group({ title, footer, children, id }: { title?: string; footer?: ReactNode; children: ReactNode; id?: string }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className="group" aria-labelledby={headingId} id={id}>
      {title && <h2 className="group-title" id={headingId}>{title}</h2>}
      <ul className="group-list">{children}</ul>
      {footer && <p className="group-footer">{footer}</p>}
    </section>
  );
}

/** One row: a label, an optional value on the right, and a chevron when it goes somewhere. */
export function Row({ label, value, href, onClick, icon: RowIcon, tone, external }: {
  label: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: () => React.JSX.Element;
  tone?: "danger" | "accent";
  external?: boolean;
}) {
  const content = (
    <>
      {RowIcon && <span className="row-icon" aria-hidden="true"><RowIcon /></span>}
      <span className="row-label">{label}</span>
      {value !== undefined && <span className="row-value">{value}</span>}
      {(href || onClick) && !tone && <span className="row-chevron" aria-hidden="true"><Icon.chevronRight /></span>}
    </>
  );
  const cls = `row-item${tone ? ` ${tone}` : ""}`;
  return (
    <li>
      {href
        ? external
          ? <a href={href} className={cls} target="_blank" rel="noopener noreferrer">{content}<span className="sr-only"> (opens in a new tab)</span></a>
          : <Link href={href} className={cls}>{content}</Link>
        : onClick
        ? <button type="button" className={cls} onClick={onClick}>{content}</button>
        : <div className={cls}>{content}</div>}
    </li>
  );
}

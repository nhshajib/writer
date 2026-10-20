/**
 * TypeWit mark: a rounded blue tile with a "T" and a text cursor beside it.
 * Same drawing as public/brand/mark.svg (see scripts/brand.py).
 */
export function Logo({ className = "logo" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#0b57d0" />
      <path d="M18 19.5h27M31.5 19.5v26" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
      <rect x="40.5" y="31.5" width="7" height="16" rx="3.5" fill="#8ab4f8" />
    </svg>
  );
}

/** The name as set in the logo: "Type" in ink, "Wit" in the accent colour. */
export function Wordmark() {
  return <span className="wordmark">Type<span className="wordmark-wit">Wit</span></span>;
}

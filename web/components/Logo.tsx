/** TypeWit mark: a rounded blue tile with a text cursor. */
export function Logo({ className = "logo" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect width="28" height="28" rx="7" fill="#0b57d0" />
      <path d="M9 8.5h10M14 8.5v11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="18.2" y="16.5" width="2.2" height="5" rx="1.1" fill="#8ab4f8" />
    </svg>
  );
}

/** A calm placeholder in the shape of the page that is loading, with the same words for screen readers. */
export function Skeleton({ label, variant = "page" }: { label: string; variant?: "page" | "card" }) {
  return (
    <div className={`skeleton skeleton-${variant}`} role="status">
      <span className="sr-only">{label}</span>
      {variant === "page" && <span className="sk sk-title" aria-hidden="true" />}
      {variant === "page" && <span className="sk sk-line short" aria-hidden="true" />}
      <span className="sk sk-card" aria-hidden="true" />
      <span className="sk sk-line" aria-hidden="true" />
      <span className="sk sk-line" aria-hidden="true" />
      {variant === "page" && <span className="sk sk-card low" aria-hidden="true" />}
    </div>
  );
}

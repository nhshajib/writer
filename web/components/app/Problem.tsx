import Link from "next/link";
import { friendlyError, redact } from "@/lib/errors";

/**
 * A problem from a session in plain words: what happened, what to do, and the
 * technical text behind a disclosure. Messages already written for people show as they are.
 */
export function Problem({ message, compact = false }: { message: string | null | undefined; compact?: boolean }) {
  if (!message) return null;
  const friendly = friendlyError(message);
  if (!friendly) return <span>{redact(message)}</span>;
  return (
    <span className="problem">
      <strong>{friendly.title}.</strong> {!compact && friendly.help}
      {friendly.action && !compact && <> <Link href={friendly.action.href}>{friendly.action.label}</Link></>}
      <details className="problem-details">
        <summary>Technical details</summary>
        <code>{friendly.details}</code>
      </details>
    </span>
  );
}

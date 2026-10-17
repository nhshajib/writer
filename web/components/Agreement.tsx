import { TERMS_SECTIONS } from "@/lib/terms";

/** The Responsible Use Agreement, shown in full. `headingLevel` keeps the outline correct where it's embedded. */
export function Agreement({ id, compact = false }: { id?: string; compact?: boolean }) {
  return (
    <div id={id} className={compact ? "agreement" : undefined} tabIndex={compact ? 0 : undefined}
      role={compact ? "region" : undefined} aria-label={compact ? "Responsible Use Agreement" : undefined}>
      {TERMS_SECTIONS.map((section) => (
        <section key={section.heading}>
          <h3>{section.heading}</h3>
          <ul>
            {section.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

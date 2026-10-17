import { TERMS_SECTIONS } from "@/lib/terms";

/**
 * The Responsible Use Agreement, shown in full. `headingLevel` keeps the page
 * outline correct wherever it is embedded.
 */
export function Agreement({
  id,
  compact = false,
  headingLevel = 3,
}: {
  id?: string;
  compact?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <div
      id={id}
      className={compact ? "agreement" : undefined}
      tabIndex={compact ? 0 : undefined}
      role={compact ? "region" : undefined}
      aria-label={compact ? "Agreement text" : undefined}
    >
      {TERMS_SECTIONS.map((section) => (
        <section key={section.heading}>
          <Heading>{section.heading}</Heading>
          <ul>
            {section.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
      ))}
    </div>
  );
}

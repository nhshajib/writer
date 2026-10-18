import type { Metadata } from "next";
import { Agreement } from "@/components/Agreement";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const metadata: Metadata = { title: "Responsible Use Agreement" };

export default function ResponsibleUsePage() {
  return (
    <article className="prose">
      <h1>Responsible Use Agreement</h1>
      <p className="updated">Version {CURRENT_TERMS_VERSION}. Everyone agrees to this before using TypeWit.</p>
      <Agreement headingLevel={2} />
    </article>
  );
}

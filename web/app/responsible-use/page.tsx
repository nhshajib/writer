import type { Metadata } from "next";
import { Agreement } from "@/components/Agreement";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const metadata: Metadata = { title: "Responsible Use Agreement · Writer" };

export default function ResponsibleUsePage() {
  return (
    <article style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1>Responsible Use Agreement</h1>
      <p className="muted">Version {CURRENT_TERMS_VERSION}. Everyone agrees to this before using Writer.</p>
      <Agreement headingLevel={2} />
    </article>
  );
}

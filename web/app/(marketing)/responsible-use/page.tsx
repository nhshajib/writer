import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Agreement } from "@/components/Agreement";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const metadata: Metadata = pageMeta("/responsible-use/", "Responsible Use Agreement", "What TypeWit is for and what it isn't: an assistive tool that enters text you wrote or approved, clearly labelled as automated text entry.");

export default function ResponsibleUsePage() {
  return (
    <article className="prose">
      <h1>Responsible Use Agreement</h1>
      <p className="updated">Version {CURRENT_TERMS_VERSION}. Everyone agrees to this before using TypeWit.</p>
      <Agreement headingLevel={2} />
    </article>
  );
}

import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Agreement } from "@/components/Agreement";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const metadata: Metadata = pageMeta("/responsible-use/", "Responsible Use Agreement", "What TypeWit is for and what it isn't: authorized testing of automated text entry, with academic cheating and deceptive authorship claims prohibited.");

export default function ResponsibleUsePage() {
  return (
    <article className="prose">
      <h1>Responsible Use Agreement</h1>
      <p className="updated">Version {CURRENT_TERMS_VERSION}. Everyone agrees to this before using TypeWit.</p>
      <Agreement headingLevel={2} />
    </article>
  );
}

import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { TermsBody } from "@/components/legal/Terms";
import { LEGAL_UPDATED } from "@/lib/site";
import { OnThisPage } from "@/components/legal/OnThisPage";

export const metadata: Metadata = pageMeta("/terms/", "Terms of Service", "The terms for using TypeWit, including plans, billing, cancelling and acceptable use.");

export default function TermsPage() {
  return (
    <article className="prose"><Breadcrumbs items={[{ name: "Terms of Service", path: "/terms/" }]} />
      <h1>Terms of Service</h1>
      <p className="updated">Last updated {LEGAL_UPDATED}</p>
      <OnThisPage />
      <TermsBody />
    </article>
  );
}

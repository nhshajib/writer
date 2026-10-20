import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { TermsBody } from "@/components/legal/Terms";
import { LEGAL_UPDATED } from "@/lib/site";

export const metadata: Metadata = pageMeta("/terms/", "Terms of Service", "The terms for using TypeWit, including plans, billing, cancelling and acceptable use.");

export default function TermsPage() {
  return (
    <article className="prose">
      <h1>Terms of Service</h1>
      <p className="updated">Last updated {LEGAL_UPDATED}</p>
      <TermsBody />
    </article>
  );
}

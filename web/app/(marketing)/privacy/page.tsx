import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { PrivacyBody } from "@/components/legal/Privacy";
import { LEGAL_UPDATED } from "@/lib/site";
import { OnThisPage } from "@/components/legal/OnThisPage";

export const metadata: Metadata = pageMeta("/privacy/", "Privacy Policy", "What TypeWit stores, why, and for how long. We only open documents you use with TypeWit, and never sell data or use your text to train AI.");

export default function PrivacyPage() {
  return (
    <article className="prose"><Breadcrumbs items={[{ name: "Privacy Policy", path: "/privacy/" }]} />
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated {LEGAL_UPDATED}</p>
      <OnThisPage />
      <PrivacyBody />
    </article>
  );
}

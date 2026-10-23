import { pageMeta } from "@/lib/seo";
import { InformationPage } from "@/components/marketing/InformationPage";
import { FAQ } from "@/lib/marketing-content";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
export const metadata = pageMeta(
  "/faq/",
  "Frequently asked questions",
  "Answers about TypeWit plans, Google Docs permissions, Word sessions, background entry, dictation and responsible use before you start.",
);
export default function Page() {
  return (
    <InformationPage
      title={"Frequently asked questions"}
      intro={"Answers about TypeWit plans, Google Docs permissions, Word sessions, background entry, dictation and responsible use before you start."}
      path="/faq/"
    >
      <div className="faq standalone-faq">
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <p className="information-section">
        Still have a question? <Link href="/support/">Contact support</Link>
        {" "}
        or browse our <Link href="/guides/">guides</Link>.
      </p>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
    </InformationPage>
  );
}

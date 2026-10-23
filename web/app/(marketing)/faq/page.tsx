import { pageMeta } from "@/lib/seo";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
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
    <div className="container faq-page">
      <Breadcrumbs items={[{name:"Frequently asked questions",path:"/faq/"}]} />
      <section className="faq-layout" aria-labelledby="faq-page-title">
        <header className="faq-introduction"><h1 id="faq-page-title">Questions?<br />We’re here to help.</h1><div><p>Clear answers about your documents, plans and control. Need a hand with something else?</p><Link className="btn btn-primary" href="/support/">Contact support</Link></div></header>
        <div className="faq question-cards">{FAQ.map((item,i)=><details key={item.q} open={i === 0}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
      </section>
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
    </div>
  );
}

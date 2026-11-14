import { pageMeta } from "@/lib/seo";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FAQ } from "@/lib/marketing-content";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
export const metadata = pageMeta(
  "/faq/",
  "Auto Typer FAQ: Google Docs, Word & Plans",
  "Answers about the TypeWit auto typer: the free plan, Google Docs permissions, Word sessions, entry after you close the tab, dictation and responsible use.",
);
export default function Page() {
  return (
    <div className="container faq-page">
      <Breadcrumbs items={[{name:"Frequently asked questions",path:"/faq/"}]} />
      <section className="faq-layout" aria-labelledby="faq-page-title">
        <header className="faq-introduction"><h1 id="faq-page-title">Auto typer questions,{" "}<br />answered.</h1><div><p>Clear answers about your documents, plans and control. Need a hand with something else?</p><Link className="btn btn-primary" href="/support/">Contact support</Link></div></header>
        <div className="faq question-cards">{FAQ.map((item,i)=><details key={item.q} open={i === 0}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
        <nav className="faq-more" aria-label="More answers">
          <h2>More answers</h2>
          <ul>
            <li><Link href="/pricing/">Compare Free, Day Pass and Pro</Link></li>
            <li><Link href="/google-docs-auto-typer/">Google Docs auto typer</Link></li>
            <li><Link href="/word-auto-typer/">Microsoft Word auto typer</Link></li>
            <li><Link href="/guides/paste-text-keep-formatting-google-docs/">Paste without losing formatting</Link></li>
            <li><Link href="/guides/google-docs-version-history/">Version history and automated edits</Link></li>
            <li><Link href="/privacy/">Privacy Policy</Link></li>
          </ul>
        </nav>
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

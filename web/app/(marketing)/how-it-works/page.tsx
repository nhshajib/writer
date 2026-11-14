import { pageMeta } from "@/lib/seo";
import { InformationPage } from "@/components/marketing/InformationPage";
import { STEPS } from "@/lib/marketing-content";
import Link from "next/link";
export const metadata = pageMeta(
  "/how-it-works/",
  "How TypeWit Works: Auto Type into Google Docs & Word",
  "How the TypeWit auto typer works: paste formatted text, choose a rhythm and finish time, approve, and follow entry into Google Docs or Microsoft Word.",
);
export default function Page() {
  return (
    <InformationPage
      title={"How TypeWit auto types into Google Docs and Word"}
      intro={"Three steps take your prepared draft from the editor to a document. Start with a short sample to check the result."}
      path="/how-it-works/"
      crumb="How it works"
    >
      <ol className="lp-steps">
        {STEPS.map(({ icon: StepIcon, title, text }, i) => (
          <li key={title}>
            <span className="lp-step-top">
              <span className="lp-num">{i + 1}</span>
              <span className="lp-icon">
                <StepIcon />
              </span>
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <section className="information-section">
        <h2>Choose the document you already use</h2>
        <p>
          Create a new Google Doc with your chosen title, or pick an existing
          one from Drive. Connect only the accounts and documents you want to
          use.
        </p>
        <div className="information-links">
          <Link href="/google-docs-auto-typer/">
            Google Docs: runs in the background →
          </Link>
          <Link href="/word-auto-typer/">
            Word: keep the document and add-in open →
          </Link>
          <Link href="/guides/">Read the step-by-step guides →</Link>
        </div>
      </section>
      <section className="information-section">
        <h2>Review, pause, or change direction</h2>
        <p>
          Pause or stop from the session controls. Pro users can replace remaining
          text or change settings while paused, then approve the changes and resume.
        </p>
        <p>
          Writing blocks add long rests between periods of entry. Times are
          targets; outages, document conflicts and expired access may delay or
          stop continuation.
        </p>
      </section>
    </InformationPage>
  );
}

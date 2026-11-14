import { pageMeta } from "@/lib/seo";
import { InformationPage } from "@/components/marketing/InformationPage";
import { USES } from "@/lib/marketing-content";
import Link from "next/link";
export const metadata = pageMeta(
  "/use-cases/",
  "Auto Typer Use Cases: Testing, Formatting & Accessibility",
  "What TypeWit’s auto typer is used for: testing document workflows, checking formatting, comparing pacing and hands-free entry of your own approved text.",
);
export default function Page() {
  return (
    <InformationPage
      title={"What people use an auto typer for"}
      intro={"Choose a test with a clear outcome: confirm formatting, compare pacing, or check an accessible document-entry workflow."}
      path="/use-cases/"
      crumb="Use cases"
    >
      <div className="use-case-grid">
        {USES.map((title, i) => (
          <section key={title}>
            <span className="lp-num">0{i + 1}</span>
            <h2>{title}</h2>
            <p>
              {[
                "Test scheduled text-entry workflows in a document you own or have permission to use. Inspect confirmed actions in the activity log.",
                "Bring a formatted sample, review supported styles, and check how headings, emphasis and highlights arrive in your chosen document.",
                "Compare Natural and Steady rhythms, or use paid controls to test longer blocks, breaks and custom pacing.",
                "Dictate elsewhere or prepare your draft with tools you already use. Paste, approve, and control entry with keyboard and screen-reader support.",
              ][i]}
            </p>
          </section>
        ))}
      </div>
      <section className="information-section">
        <h2>Your draft, your words</h2>
        <p>
          TypeWit enters the text you approve. It is not an AI writer, rewriter
          or humanizer, and it is for authorized use only.
        </p>
        <Link href="/responsible-use/">
          Read the Responsible Use Agreement →
        </Link>
      </section>
    </InformationPage>
  );
}

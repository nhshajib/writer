import { pageMeta } from "@/lib/seo";
import { InformationPage } from "@/components/marketing/InformationPage";
import { FEATURES } from "@/lib/marketing-content";
import Link from "next/link";
export const metadata = pageMeta(
  "/features/",
  "Features that keep you in control",
  "Explore approved text entry, formatted paste, flexible pacing, writing blocks and session controls for Google Docs and Microsoft Word.",
);
export default function Page() {
  return (
    <InformationPage
      title={"Features that keep you in control"}
      intro={"Review what each control does, from formatted paste to pauses and simulated corrections. Choose the settings your test needs."}
      path="/features/"
    >
      <ul className="lp-features">
        {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
          <li key={title}>
            <span className="lp-icon">
              <FeatureIcon />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </li>
        ))}
      </ul>
      <section className="information-section">
        <h2>Formatting comes with your text</h2>
        <p>
          Paste supported headings, bold, italics, bullets and highlights
          directly. No need to recreate them with Markdown. Formatted paste is
          included on Free; Pro adds file import.
        </p>
      </section>
      <section className="information-section">
        <h2>Writing blocks and natural rhythms</h2>
        <p>
          Free includes Natural and Steady rhythms. Day Pass and Pro add writing
          hours and customizable writing blocks, with rests up to eight hours.
          Pro adds adjustable speed, sentence pauses, corrected temporary typos,
          false starts, presets and scheduled starts.
        </p>
        <p>
          Review the total schedule before starting. Every Day Pass restart and
          the finish must fit before expiry. These are automated edits; timing
          and corrections do not prove human authorship or guarantee separate
          Google revision groups.
        </p>
      </section>
      <section className="information-section">
        <h2>See the setup for your document</h2>
        <p>
          The <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link> runs in the cloud.
          The <Link href="/word-auto-typer/">Microsoft Word auto typer</Link> uses an open add-in.
          Each setup guide explains permissions and supported formatting.
        </p>
      </section>
    </InformationPage>
  );
}

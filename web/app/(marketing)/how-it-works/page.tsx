import Link from "next/link";
import { InformationPage } from "@/components/marketing/InformationPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageByline } from "@/components/seo/PageByline";
import { FEATURES, STEPS, USES } from "@/lib/marketing-content";
import { PAGE_UPDATED } from "@/lib/search-content";
import { pageMeta } from "@/lib/seo";
import { webPage } from "@/lib/structured-data";

const TITLE = "How TypeWit Works: Auto Typer for Google Docs & Word";
const DESCRIPTION =
  "See how the TypeWit auto typer works, with real screenshots: paste formatted text, choose a rhythm and finish time, then follow entry in Google Docs or Word.";
export const metadata = pageMeta("/how-it-works/", TITLE, DESCRIPTION);

/** Real dashboard screens, one per step, captured from the app at desktop and phone size (public/screens). */
const SHOTS = [
  { src: "/screens/paste-formatted-text.webp", phone: { src: "/screens/paste-formatted-text-m.webp", width: 640, height: 1251 }, width: 1200, height: 705, alt: "The TypeWit editor with pasted text that kept its heading, bold words and bullet list" },
  { src: "/screens/choose-rhythm.webp", phone: { src: "/screens/choose-rhythm-m.webp", width: 640, height: 1368 }, width: 1200, height: 924, alt: "Choosing the Natural, Steady or Drafting rhythm and a finish time, with the schedule summary below" },
  { src: "/screens/session-activity-log.webp", phone: { src: "/screens/session-activity-log-m.webp", width: 640, height: 835 }, width: 1400, height: 1274, alt: "A finished session in the dashboard: progress, the schedule timeline and the activity log" },
];
const CAPTIONS = ["Formatting stays as you pasted it.", "Pick a rhythm and when it should finish.", "Every step is logged; pause or stop at any time."];

export default function Page() {
  return (
    <InformationPage
      title="How TypeWit auto types into Google Docs and Word"
      intro="TypeWit enters text you have already written into a Google Doc or a Word document, a little at a time, over a period you choose. Here is the whole process, with real screens from the app."
      path="/how-it-works/"
      crumb="How it works"
    >
      <PageByline updated={PAGE_UPDATED["/how-it-works/"]} />
      <ol className="how-steps">
        {STEPS.map(({ title, text }, i) => (
          <li key={title} className="how-step">
            <div className="how-step-copy">
              <span className="lp-num">{i + 1}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
            <figure className="how-shot">
              <picture>
                <source media="(max-width: 767px)" srcSet={SHOTS[i].phone.src} width={SHOTS[i].phone.width} height={SHOTS[i].phone.height} />
                <img src={SHOTS[i].src} width={SHOTS[i].width} height={SHOTS[i].height} alt={SHOTS[i].alt} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
              </picture>
              <figcaption>{CAPTIONS[i]}{i === 0 && <> See <Link href="/guides/paste-text-keep-formatting-google-docs/">how to paste without losing formatting</Link>.</>}{i === 2 && <> How this compares with <Link href="/guides/google-docs-version-history/">Google Docs version history</Link>.</>}</figcaption>
            </figure>
          </li>
        ))}
      </ol>

      <section className="information-section">
        <h2>Google Docs or Microsoft Word</h2>
        <p>
          The <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link> runs on TypeWit’s servers, so a
          session keeps going after you close the tab. Use a new document or pick one in Google’s file picker. The{" "}
          <Link href="/word-auto-typer/">Microsoft Word auto typer</Link> is an add-in that works while the document is
          open.
        </p>
      </section>

      <section className="information-section how-wide" id="features" aria-labelledby="features-title">
        <h2 id="features-title">Features</h2>
        <ul className="lp-features">
          {FEATURES.map(({ icon: FeatureIcon, title, text }) => (
            <li key={title}>
              <span className="lp-icon"><FeatureIcon /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
        <p>
          Formatted paste is on every plan; Pro adds .docx, .md and .txt import. Free includes the Natural and Steady
          rhythms. Day Pass and Pro add writing hours and writing blocks with rests of up to eight hours, and Pro adds
          adjustable speed, sentence pauses, the Drafting rhythm, presets and scheduled starts.{" "}
          <Link href="/pricing/">Compare plans</Link>.
        </p>
      </section>

      <section className="information-section how-wide" id="use-cases" aria-labelledby="uses-title">
        <h2 id="uses-title">What people use it for</h2>
        <div className="use-case-grid">
          {USES.map(({ title, text }) => (
            <section key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </section>
          ))}
        </div>
        <p className="how-note">
          Your draft, your words: TypeWit is not an AI writer, rewriter or humanizer, and it is for authorized use
          under the <Link href="/responsible-use/">Responsible Use Agreement</Link>.
        </p>
      </section>

      <section className="information-section">
        <h2>Pause, review or change direction</h2>
        <p>
          Pause or stop from the session page or the dashboard. Pro users can replace the remaining text or change
          settings while paused, then approve the change and resume. Finish times are targets: an outage, a document
          conflict or expired access can delay or stop a session, and the activity log shows what happened.
        </p>
      </section>
      <JsonLd data={{ "@context": "https://schema.org", ...webPage({ path: "/how-it-works/", name: TITLE, description: DESCRIPTION, published: "2026-10-16", updated: PAGE_UPDATED["/how-it-works/"] }), primaryImageOfPage: { "@type": "ImageObject", url: `https://typewit.com${SHOTS[0].src}`, width: SHOTS[0].width, height: SHOTS[0].height } }} />
    </InformationPage>
  );
}

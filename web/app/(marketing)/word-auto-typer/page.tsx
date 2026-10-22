import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Questions } from "@/components/seo/Questions";
import { pageMeta } from "@/lib/seo";
import { DAY_PASS_PRICE } from "@/lib/site";
export const metadata = pageMeta("/word-auto-typer/", "Microsoft Word Auto Typer Add-in", "Enter approved text into Microsoft Word with the TypeWit add-in. Choose pacing and supported formatting, then pause or resume while the document stays open.");
export default function WordAutoTyper() {
  return <article className="prose seo-landing"><Breadcrumbs items={[{name:"Word auto typer",path:"/word-auto-typer/"}]} />
    <p className="kicker">Microsoft Word add-in</p><h1>A Word auto typer inside your document.</h1>
    <p className="seo-summary">TypeWit’s Word add-in enters text you approve into the document beside it. Choose a rhythm and duration, follow progress, and pause or stop whenever you need to review the result.</p>
    <div className="row"><Link href="/signup/" className="btn btn-primary">Create a free account</Link><Link href="/app/connections/#word" className="btn btn-secondary">Word setup instructions</Link></div>
    <p className="hint">For authorized testing. Keep Word and the TypeWit panel open during entry.</p>
    <h2>How to set up the Word add-in</h2>
    <ol><li>Save your Word document in OneDrive or SharePoint and make sure you have permission to edit it.</li><li>Open the Word setup instructions in Connected accounts in your TypeWit dashboard. Download the add-in manifest from that page.</li><li>In Word on the web, use the add-in upload option to select the manifest. Your organization’s Microsoft settings may restrict sideloading; ask its administrator if the option is unavailable.</li><li>Open the TypeWit panel, sign in, paste your text and choose a rhythm and duration.</li><li>Review and approve the text before starting. Leave the document and panel open while it runs.</li></ol>
    <p>This is a sideloaded add-in workflow, not a claim that TypeWit is listed in Microsoft’s public add-in marketplace. An organization’s administrator can deploy the manifest for supported Word desktop installations. Availability depends on the host and its policies.</p>
    <h2>Supported formatting and pacing</h2>
    <p>Paste into the visual editor to keep supported bold, italic, headings, bullets and highlights without adding Markdown markers. Heading styles depend on the Word host’s API support; font and page-layout reproduction are not promised. Always inspect the document after testing.</p>
    <p>Free includes Natural and Steady rhythms and 250 words a day; a {DAY_PASS_PRICE} Day Pass removes the word limit for 24 hours. Pro adds Drafting and advanced pacing controls, including adjustable speed, timing variation, temporary typos, false starts and sentence pauses. These are simulations; they do not establish human authorship. Review enabled temporary edits before approval.</p>
    <h2>Word sessions need an open document</h2>
    <p>Unlike TypeWit’s Google Docs sessions, Word entry runs through the open add-in. Closing the panel or document prevents entry. When execution resumes, the remaining schedule can move later rather than inserting the delayed text in a burst.</p>
    <p>Pause, resume and stop controls are also available in the dashboard. For Pro sessions, safely pause before editing remaining text or timing. The entered prefix stays in the document; review and approve a replacement before resuming.</p>
    <h2>What happens to your account and document?</h2>
    <p>The Word host grants the add-in access to its open document. TypeWit does not store a Microsoft password or OAuth token. Approved session text and activity are stored to provide the service, as explained in the <Link href="/privacy/">Privacy Policy</Link>.</p>
    <p>Use a test document with appropriate permissions and follow the <Link href="/responsible-use/">Responsible Use Agreement</Link>. Automated entry must not be used for academic cheating or deceptive authorship claims.</p>
    <h2>Writing blocks and long rests</h2>
    <p>Day Pass and Pro include customizable writing blocks and rests up to 8 hours. The same saved schedule resumes when due, but Word needs its document and the TypeWit add-in open. Closing Word can delay continuation. The preview includes long rests and checks remaining Day Pass access.</p>
    <h2>Compare Word and Google Docs entry</h2>
    <p>If you need cloud execution after closing the browser, see the <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link>. Both providers share the Free and Pro tiers; compare limits and billing on the <Link href="/pricing/">pricing page</Link>. Our <Link href="/guides/">guides</Link> explain formatting and how application logs differ from a provider’s history.</p>
    <Questions items={[
      { q: "Does it work in Word for Windows and Mac?", a: "You can add the TypeWit add-in to Word on the web yourself. In Word for Windows and Mac, your organization’s administrator can deploy it. Availability depends on your Microsoft account and its policies." },
      { q: "Do I need to keep Word open?", a: <>Yes. Word entry runs inside the open add-in, so keep the document and the TypeWit panel open until it finishes. If you need entry to continue after closing your computer, use the <Link href="/google-docs-auto-typer/">Google Docs auto typer</Link>, which runs in the cloud.</> },
      { q: "Can Word type text automatically without an add-in?", a: <>For text you reuse, yes: AutoCorrect and Quick Parts insert saved snippets, and Dictate types what you say. Our guide on <Link href="/guides/auto-type-text-microsoft-word/">how to auto type text in Word</Link> explains when each fits.</> },
      { q: "Is the Word auto typer free?", a: <>Yes, on the Free plan with 250 words a day. Free, Day Pass and Pro cover both Word and Google Docs; compare them on the <Link href="/pricing/">pricing page</Link>.</> },
    ]} />
  </article>;
}

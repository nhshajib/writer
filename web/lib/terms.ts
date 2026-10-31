/**
 * Responsible Use Agreement. Users read and accept it at sign-up; the version
 * is stored on their profile and the server refuses to write for anyone who
 * hasn't accepted the current one. Must match supabase/functions/_shared/terms.ts.
 */
export const CURRENT_TERMS_VERSION = "2026-10-21";

export interface TermsSection {
  heading: string;
  points: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  { heading: "Testing only", points: [
    "TypeWit is provided only for authorized testing and demonstration of automated document entry. It is not developed or authorized for academic cheating.",
    "Natural, Steady and Drafting are automated rhythms. Variable word groups, timing, sentence pauses, temporary typos and false starts can simulate drafting behavior. These edits are automation, not evidence of human authorship or time spent writing.",
  ] },
  { heading: "No cheating or deceptive history", points: [
    "Do not use TypeWit to cheat on coursework, exams or assessments, fabricate evidence of authorship or a writing process, disguise copied or AI-generated work as your own, evade integrity checks, or mislead a school, employer, client or reviewer.",
    "A disclaimer does not make prohibited conduct acceptable. You must obtain any required permission and disclose automated entry where relevant. Follow applicable laws, intellectual-property rights and institutional rules.",
  ] },
  { heading: "Your documents and approval", points: [
    "Use only accounts, documents and text you own or have permission to use for testing. Review the text, formatting, destination and settings before approval. Supported formatting may differ from the source; inspect the preview and final document.",
    "Pro users can edit remaining text and settings while a session is safely paused. Changed text requires fresh approval. Text already entered is not rewritten by this editor.",
    "Temporary mistakes may be visible to collaborators and can remain in document history even after correction. Avoid sensitive or production documents; keep your own backups. Pause or stop if anything is unexpected.",
  ] },
  { heading: "History and control", points: [
    "Google Docs records edits from your connected account and controls their grouping and visibility in version history. TypeWit cannot guarantee separate visible versions, a particular history pattern, an exact finish time, or uninterrupted execution.",
    "A Day Pass is a one-time $3.99 purchase for 24 hours from payment confirmation; it does not renew. At expiry, unfinished pass sessions pause without deleting document text. Writing hours may extend elapsed completion; choose a schedule that fits the remaining access window. Pro playback is a read-only replay of TypeWit actions, not Google snapshots. A final revision pass briefly edits the session-owned suffix and restores approved text.",
    "Google Docs sessions run on our servers until paused, stopped or completed. Word sessions require the add-in and document to remain open. Disconnecting an account stops its active sessions; it does not remove edits already made.",
  ] },
  { heading: "Your responsibility", points: [
    "You are responsible for your content, permissions, approvals, use of the service and consequences of misuse, including academic, employment or contractual consequences. TypeWit does not approve or endorse misuse.",
    "To the maximum extent permitted by applicable law, the operator disclaims liability for your misuse or third-party decisions based on it. The warranty disclaimers, liability limits and mandatory legal protections in the Terms apply; no clause excludes a liability that cannot lawfully be excluded.",
  ] },
  { heading: "Your account and agreement", points: [
    "Use accurate information and one account per person. A Pro trial is available once per eligible person; do not bypass plan or trial limits. Keep access secure and promptly report unauthorized use.",
    "You accept the Terms of Service and this Responsible Use Agreement and acknowledge the Privacy Policy. We may suspend prohibited use or require renewed acceptance when these rules change.",
  ] },
];

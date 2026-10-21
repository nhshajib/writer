/** One source for public discovery links, article metadata and sitemap dates. Dates change only with substantive edits. */
export const CONTENT_UPDATED = "2026-10-21";
export interface Guide {
  slug: string; title: string; description: string; summary: string;
  sections: { heading: string; paragraphs: string[]; steps?: string[] }[];
  sources: { label: string; url: string }[];
}
export const GUIDES: Guide[] = [
  {
    slug: "schedule-text-google-docs", title: "How to Schedule Text Entry in Google Docs",
    description: "Schedule approved text entry into a new or existing Google Doc with TypeWit. Learn about session duration, scheduled starts, pauses and formatting.",
    summary: "Choose when automated entry should run, how long it should take, and which document should receive your approved text. A scheduled start and a session’s duration are two different settings.",
    sections: [
      { heading: "What scheduling does", paragraphs: [
        "TypeWit enters text you supply into a Google Doc through Google’s API. It does not generate the draft. You review the destination, exact text and supported formatting before approving a session. Use it only for authorized testing of document-entry workflows.",
        "The duration spreads a session’s edits over a chosen window. A scheduled start delays the beginning until a later date and time. Starting later is a Pro feature; Free sessions start now and can run for up to 30 minutes. Pro supports sessions up to a week.",
      ] },
      { heading: "Set up a Google Docs session", paragraphs: [], steps: [
        "Connect a Google account from Connected accounts in the dashboard. Google sign-in and permission to access a document are separate steps.",
        "Open New session and paste your text. Check that headings, bold, italic, bullets and highlight colors appear as expected.",
        "Choose New Google Doc and optionally enter a title, or choose Existing document and use the Google Drive picker. Select the correct account if you connected more than one.",
        "Choose Natural or Steady, or use the Pro Drafting rhythm. Set the total duration. Pro users can expand Advanced settings to customize pacing and choose a later start.",
        "Review the destination and text, approve the session, and start. Follow progress and the activity log from your dashboard.",
      ] },
      { heading: "Do you need to leave the browser open?", paragraphs: [
        "Google Docs sessions run on TypeWit’s servers. Once a session has started, you can close the dashboard or let your computer sleep. The connected Google account must retain access to the selected document.",
        "This differs from the Word add-in: a Word session needs its document and TypeWit panel to remain open. Do not assume a desktop auto typer or browser extension has the same background behavior.",
      ] },
      { heading: "Pause, revise, and resume", paragraphs: [
        "Pause to review the destination document or stop future edits. Pro users can change remaining text and settings while the session is safely paused. Already entered text stays in place. Approve changed text again, save, and then choose Resume.",
        "If an edit is still finishing, a document check needs attention, or a temporary simulated mistake awaits correction, the editor may ask you to resolve that first. This prevents a new schedule from overlapping an uncertain write.",
      ] },
      { heading: "Treat the finish time as a target", paragraphs: [
        "Provider outages, rate limits and document conflicts can delay a session. TypeWit can move the remaining schedule later rather than rushing delayed edits. Inspect the session’s status and activity log before relying on its output.",
        "Google controls how edits appear in version history. A scheduled session does not guarantee a separate visible version for every word group, and automated edits do not demonstrate human authorship or time spent drafting. Academic cheating and fabricated writing histories are prohibited.",
      ] },
    ], sources: [{ label: "Google Docs: find changes and version history", url: "https://support.google.com/docs/answer/190843" }],
  },
  {
    slug: "paste-text-keep-formatting-google-docs", title: "Paste Text into Google Docs Without Losing Formatting",
    description: "Keep headings, bold, italic, bullets and highlights when pasting text. Compare normal Google Docs paste with TypeWit’s scheduled formatted text entry.",
    summary: "For a normal one-time paste, use Google Docs directly. If you need approved text entered over time for testing, TypeWit can preserve its supported formatting without asking you to rewrite it as Markdown.",
    sections: [
      { heading: "Start with the paste option you actually need", paragraphs: [
        "For an immediate paste into Google Docs, copy the source and use the normal Paste command in the document. The separate Paste without formatting command intentionally removes styles. Google’s keyboard-shortcut reference lists the commands for your operating system; browser restrictions can affect menu-based clipboard access.",
        "If formatting disappears, check whether the source application copied rich text or only plain text. A plain-text clipboard has no heading or highlight information for another application to recover. Try copying from the original formatted document rather than from a plain-text intermediary.",
      ] },
      { heading: "Paste formatted text into TypeWit", paragraphs: [
        "Open New session and paste normally into Text to enter. TypeWit reads supported clipboard formatting and shows a visual editor. You do not need to add # before headings or ** around bold text. Formatted paste is included on Free.",
        "The Paste formatted text button is another option. If your browser refuses clipboard access, tap the editor and use the system Paste action, or press your normal paste shortcut. Browser permission for a toolbar button is separate from a user-initiated keyboard paste.",
      ], steps: [
        "Copy a small formatted sample containing the styles you want to keep.",
        "Paste it into the editor and inspect headings, bold, italic, bullets and highlight colors.",
        "Choose an existing Google Doc or create a new one, then select a rhythm and duration.",
        "Review and approve the text and destination before starting. Inspect the destination document after entry.",
      ] },
      { heading: "What is preserved, and what is not?", paragraphs: [
        "TypeWit supports text, recognized titles and subtitles, headings, bold, italic, bullets and highlight colors. It does not reproduce a whole page layout: images, tables, source fonts and page settings are outside this formatting subset. Clipboard formats differ between applications, so use the visual editor and final review to confirm the result.",
        "Paragraph styles apply at paragraph boundaries. If you append a heading inside an existing paragraph, TypeWit keeps the existing paragraph’s style to avoid restyling earlier content. Start your pasted text with a line break when a new heading needs a new paragraph, or use a blank document.",
      ] },
      { heading: "Editing and importing are different workflows", paragraphs: [
        "The editor lets you adjust heading levels, bold, italic and highlighting before approval. Any text change clears approval. Pro also supports .docx, .md and .txt imports; importing a file does not guarantee that every feature of its original layout can be reproduced.",
        "A Pro paused-session replacement can also contain formatted paste. Leave remaining text unchanged when you only want to adjust timing and preserve its existing formatting. Review any replacement carefully, including spaces needed to join it to the text already entered.",
      ] },
      { heading: "Keep the purpose clear", paragraphs: [
        "Formatting support is for authorized document-entry testing. Neither preserved formatting nor paced edits establish who wrote the content. Follow document permissions and the Responsible Use Agreement, and never use automated entry to fabricate academic work or evidence of authorship.",
      ] },
    ], sources: [{ label: "Google Docs keyboard shortcuts", url: "https://support.google.com/docs/answer/179738" }],
  },
  {
    slug: "google-docs-version-history", title: "Google Docs Version History and Automated Edits",
    description: "Learn how to view Google Docs version history, why edits can be grouped, and how TypeWit’s activity log differs from Google’s document history.",
    summary: "Google Docs version history records changes to a document. TypeWit’s activity log records its own automated actions. These records serve different purposes and do not necessarily contain the same number of entries.",
    sections: [
      { heading: "How to view a document’s history", paragraphs: [
        "On a computer, open the document and choose File → Version history → See version history. Google’s help explains the permissions required, viewing earlier versions, and expanding grouped versions. If you cannot see the command or an earlier version, check your document permissions and Google’s instructions first.",
        "Reviewing an earlier version is different from restoring it. Restoring changes the document’s current content, so coordinate with collaborators and avoid restoring a version during a running automated session.",
      ] },
      { heading: "Why every insertion may not have its own visible version", paragraphs: [
        "Google controls how edits are stored, grouped and presented. Several automated insertions may appear together. A session that sends many small word groups therefore does not promise an equal number of visible history entries.",
        "TypeWit cannot force permanent version boundaries or guarantee a particular visual pattern. If you need to inspect an important document state, use Google’s own history interface and consider its named-version feature. Naming a version is a Google Docs action, not a TypeWit guarantee.",
      ] },
      { heading: "What TypeWit’s activity log tells you", paragraphs: [
        "The session log records application events such as approval, planned and confirmed entry, pauses, resumes, retries and errors. You can download the log from the session. This helps investigate whether TypeWit ran as scheduled even when Google groups several edits together.",
        "The log is a record from TypeWit, not an independent authorship certificate. Document history may also contain edits made by you or collaborators outside the session. Compare the destination document, session status and relevant events when investigating a problem.",
      ] },
      { heading: "Temporary typos and false starts can remain in history", paragraphs: [
        "With Pro drafting simulations, TypeWit may enter a temporary adjacent-key typo or a wrong word, pause, delete the temporary text and correct it. A completed session is intended to match the approved text. Pausing or stopping before correction can leave temporary text in the current document.",
        "Even after a correction, earlier temporary text may remain visible in document history or to collaborators. Use a test document, review the exact enabled settings, and do not submit sensitive content you lack permission to process.",
      ] },
      { heading: "Version history is not proof of human authorship", paragraphs: [
        "A realistic-looking timeline does not demonstrate that someone manually wrote the content, that a given person authored it, or that a certain amount of drafting time was spent. Automated edits remain automation regardless of their rhythm.",
        "TypeWit is for authorized testing. Academic cheating, fabricated writing histories, evasion of integrity checks and deceptive authorship claims are prohibited. Disclose automation when required by the rules that apply to your document.",
      ] },
    ], sources: [{ label: "Google Docs: find what changed, grouped versions and named versions", url: "https://support.google.com/docs/answer/190843" }],
  },
];

export const PUBLIC_PAGES = [
  "/", "/google-docs-auto-typer/", "/word-auto-typer/", "/guides/", ...GUIDES.map(g => `/guides/${g.slug}/`),
  "/pricing/", "/support/", "/responsible-use/", "/privacy/", "/terms/",
];

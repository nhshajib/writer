/** One source for public discovery links, article metadata and sitemap dates. Dates change only with substantive edits. */
export const CONTENT_UPDATED = "2026-10-22";
export interface Guide {
  slug: string; title: string; description: string; summary: string;
  /** First published and last substantively changed, as YYYY-MM-DD. */
  published: string; updated: string;
  sections: { heading: string; paragraphs: string[]; steps?: string[] }[];
  sources: { label: string; url: string }[];
}
export const GUIDES: Guide[] = [
  {
    slug: "choose-google-docs-auto-typer", published: "2026-10-26", updated: "2026-11-08",
    title: "How to Choose a Google Docs Auto Typer",
    description: "Compare Google Docs auto typers by background execution, formatting, permissions, pacing and free limits. Use a short test before committing to a paid plan.",
    summary: "The right Google Docs auto typer depends on what you need to test: a live typing demonstration, scheduled document entry, or a repeatable formatted workflow. Start with those requirements, then compare tools using the same sample.",
    sections: [
      { heading: "First, decide whether you need an auto typer", paragraphs: [
        "For an immediate transfer, ordinary Google Docs paste is enough. For speech-to-text, use Google Docs voice typing. An auto typer is useful when approved text must arrive gradually for an authorized demonstration or document-entry test.",
        "A typing simulator does not write the content for you. Separate text generation, rewriting and paced entry when comparing products: buying one does not necessarily include the others.",
      ] },
      { heading: "Check where the typing actually runs", paragraphs: [
        "Ask whether the tool requires an open browser tab, a browser extension, a desktop app or a cloud service. Background-tab support is different from continuing after the computer shuts down. Confirm the provider’s requirements rather than assuming every auto typer runs the same way.",
        "TypeWit Google Docs sessions run on its servers through Google’s API, so the dashboard can close after starting. No Chrome extension is required. Its Microsoft Word add-in works differently: Word and the TypeWit panel must remain open.",
      ] },
      { heading: "Test formatting and exact text, not just typing speed", paragraphs: [
        "Use a disposable document and a short sample containing a heading, two sentences, bold text, a bullet list and a highlight. Include a sentence longer than 20 words if you want to inspect TypeWit’s balanced sentence steps. Review formatting before approval and compare the completed document with your sample.",
        "Check that long sentences split without losing words or punctuation. Compare Natural’s varied timing, Steady’s more consistent rhythm and Pro Drafting’s temporary corrections using the same approved sample.",
        "Formatting support is not full document conversion. TypeWit preserves supported text styles, but does not reproduce images, tables, source fonts or page layout. Test the styles you rely on before using a longer passage.",
      ], steps: [
        "Paste the same short sample into each tool and check the preview.",
        "Select the destination and a duration allowed by the free plan; approve only test text.",
        "Pause partway through, then resume and verify that completed text is not duplicated.",
        "For a cloud tool, close its dashboard and check the document later from another device.",
        "After completion, compare the exact text, formatting and activity log. Check temporary corrections have finished.",
      ] },
      { heading: "Read Google permissions before connecting", paragraphs: [
        "Read the consent screen, privacy policy and disconnect controls. Google’s drive.file scope covers files created by an app or explicitly selected for it, rather than broad Drive access.",
        "TypeWit uses drive.file for Google Docs and lets you manage authorizations in Connected accounts. It processes approved text to run sessions; cloud execution does not mean the service never receives your text. Read its Privacy Policy before submitting sensitive material.",
      ] },
      { heading: "Compare free limits and the actual billing period", paragraphs: [
        "Free can mean a daily allowance, a one-time trial, or an unlimited tool with fewer controls. Compare word limits, session length, concurrent sessions, existing-document access and whether a payment automatically renews. Check each product’s current pricing page instead of relying on an old comparison article.",
        "TypeWit offers Free, a non-renewing Day Pass and Pro. Check the current pricing comparison for word allowances, active-session limits, trial eligibility and billing terms; monthly and yearly Pro share the same features.",
        "A long rest is part of elapsed time. A Day Pass schedule must still have access when entry resumes and finishes. Review the schedule preview rather than assuming a 24-hour pass can start a new 24-hour session near expiry.",
      ] },
      { heading: "Treat version-history promises carefully", paragraphs: [
        "Google decides how document changes are grouped and retained. More API writes, word-sized steps or longer rests do not guarantee separate visible versions. Check the document itself and the tool’s activity log instead of judging success by a promised number of history entries.",
        "Choose a tool whose explanations distinguish automation from authorship: a realistic demonstration is still an automated demonstration.",
      ] },
    ], sources: [
      { label: "Google Drive: choose scopes and understand drive.file", url: "https://developers.google.com/workspace/drive/api/guides/api-specific-auth" },
      { label: "Google Docs: view and name document versions", url: "https://support.google.com/docs/answer/190843" },
      { label: "Google Docs: voice typing in supported browsers", url: "https://support.google.com/docs/answer/4492226" },
    ],
  },

  {
    slug: "schedule-text-google-docs", published: "2026-10-21", updated: "2026-11-08", title: "How to Schedule Text Entry in Google Docs",
    description: "Schedule approved text entry into a new or existing Google Doc with TypeWit. Learn about session duration, scheduled starts, pauses and formatting.",
    summary: "A scheduled start decides when entry begins; duration decides how long it takes. This guide explains how starts, writing hours and rests combine into the full Google Docs schedule.",
    sections: [
      { heading: "What scheduling does", paragraphs: [
        "TypeWit enters text you supply into a Google Doc through Google’s API. It does not generate the draft. You review the destination, exact text and supported formatting before approving a session.",
        "The duration spreads a session’s edits over a chosen window. A scheduled start delays the beginning until a later date and time. Starting later is a Pro feature; Free sessions start now and can run for up to 60 minutes. Pro supports sessions up to a week.",
      ] },
      { heading: "Set up a Google Docs session", paragraphs: [], steps: [
        "Connect a Google account from Connected accounts in the dashboard. Google sign-in and permission to access a document are separate steps.",
        "Open New session and paste your text. Check that headings, bold, italic, bullets and highlight colors appear as expected.",
        "Choose New Google Doc and optionally enter a title, or choose Existing document and use the Google Drive picker. Select the correct account if you connected more than one.",
        "Choose Natural or Steady, or use the Pro Drafting rhythm. Set the total duration. Pro users can expand Advanced settings to customize pacing and choose a later start.",
        "Review the destination and text, approve the session, and start. Follow progress and the activity log from your dashboard.",
      ] },
      { heading: "Do you need to leave the browser open?", paragraphs: [
        "Once a Google Docs session starts, the server follows its saved schedule. You can close the dashboard; the connected account must keep editing access to the document.",
        "This differs from the Word add-in: a Word session needs its document and TypeWit panel to remain open. Do not assume a desktop auto typer or browser extension has the same background behavior.",
      ] },
      { heading: "Pause, revise, and resume", paragraphs: [
        "Pause to review the destination document or stop future edits. Pro users can change remaining text and settings while the session is safely paused. Already entered text stays in place. Approve changed text again, save, and then choose Resume.",
        "If an edit is still finishing, a document check needs attention, or a temporary simulated mistake awaits correction, the editor may ask you to resolve that first. This prevents a new schedule from overlapping an uncertain write.",
      ] },
      { heading: "Treat the finish time as a target", paragraphs: [
        "Provider outages, rate limits and document conflicts can delay a session. TypeWit can move the remaining schedule later rather than rushing delayed edits. Inspect the session’s status and activity log before relying on its output.",
        "Google controls how edits appear in version history. A scheduled session does not guarantee a separate visible version for every word group.",
      ] },
      { heading: "Writing blocks and long breaks", paragraphs: [
        "Day Pass and Pro let you choose writing blocks from 5 minutes to 12 hours and rests from 15 minutes to 8 hours. In New session, enable Writing blocks. Choose Writing time; long rests are added, and the preview shows the total elapsed time. Blocks end at completed text steps so temporary corrections finish before a rest.",
        "Google Docs resumes on the server after a scheduled rest; keep Word and its add-in open for Word sessions. Manual pause, expired access, lost permissions or outages can prevent or delay continuation. TypeWit checks every Day Pass restart and finish against expiry. Shorten an incompatible schedule or upgrade to Pro. Google decides version-history grouping; longer rests do not guarantee separate versions.",
      ] },
      { heading: "Writing hours and short-term access", paragraphs: [
        "Day Pass lasts 24 hours from payment confirmation and activation, without renewal. Each restart and the finish must fit the remaining access window. Unfinished sessions pause at expiry until access is renewed or upgraded.",
        "Day Pass and Pro can limit entry to chosen daily writing hours in an IANA time zone. Overnight hours and daylight-saving changes are supported. Waiting outside those hours can extend the elapsed session time, which must still fit the plan limit.",
      ] },
    ], sources: [{ label: "Google Docs: find changes and version history", url: "https://support.google.com/docs/answer/190843" }],
  },
  {
    slug: "paste-text-keep-formatting-google-docs", published: "2026-10-21", updated: "2026-11-14", title: "Copy & Paste in Google Docs Without Losing Format",
    description: "Keep formatting with Ctrl+V, or paste text only with Ctrl+Shift+V to match your document. Fix lost bold and headings, and paste Markdown from AI chats.",
    summary: "To copy and paste in Google Docs without losing formatting, copy from the formatted original and use normal Paste: Ctrl+V on Windows or ChromeOS, Command+V on Mac. If you want the pasted text to take on your document’s format instead, use Paste without formatting: Ctrl+Shift+V, or Command+Shift+V on Mac.",
    sections: [
      { heading: "Which paste do you need?", paragraphs: [
        "Keep the source formatting (bold, headings, lists, links): use normal Paste, Ctrl+V or Command+V. Match the format of the document you are pasting into: use Paste without formatting, Ctrl+Shift+V or Command+Shift+V, or Edit > Paste without formatting. Copy only the formatting from one part of a document to another: use the Paint format tool on the toolbar.",
        "For a one-time transfer you don’t need any other tool: these are built into Google Docs. Normal Paste brings across the formatting available on the clipboard; it does not guarantee an exact copy of every font, table or page layout. Google’s keyboard-shortcut reference lists the commands for your operating system.",
      ] },
      { heading: "Paste and keep the original formatting", paragraphs: [
        "If formatting disappears, check whether the source application copied rich text or only plain text. A plain-text clipboard has no heading or highlight information for another application to recover. Copy from the original formatted document rather than from a plain-text intermediary.",
      ], steps: [
        "Select a short passage with the bold text, heading or list you want to keep in the original document or webpage.",
        "Copy with Ctrl+C on Windows or ChromeOS, or Command+C on Mac.",
        "Open the Google Doc in editing mode and place the cursor where the passage should go.",
        "Use normal Paste: Ctrl+V on Windows or ChromeOS, or Command+V on Mac. Do not add Shift if you want to retain formatting.",
        "Check the pasted styles and paragraph boundaries before copying a longer passage. Undo if the result is not what you expected.",
      ] },
      { heading: "Copy and paste without changing your document’s format", paragraphs: [
        "When pasted text arrives in the wrong font, size or color, you want it to match your document instead. Use Paste without formatting: Ctrl+Shift+V on Windows or ChromeOS, Command+Shift+V on Mac, or Edit > Paste without formatting. The words keep the style of the paragraph you paste into.",
        "Already pasted? Select the text and choose Format > Clear formatting (Ctrl+\\ or Command+\\), then apply your own heading or bold. Note that this removes the source’s bold and headings too: paste-text-only and keeping formatting are opposite choices.",
      ] },
      { heading: "Paste from Word or another Google Doc", paragraphs: [
        "Between two Google Docs, copy from the source tab and paste with Ctrl+V or Command+V: headings, lists and links come across. From Microsoft Word, copy from the open document and paste the same way. For long Word files, tables or page layout, open the .docx with File > Open in Google Docs instead of pasting.",
      ] },
      { heading: "Copy formatting with Paint format", paragraphs: [
        "To make one passage look like another inside the same document, select text that already has the look you want, click Paint format (the paint-roller icon) on the toolbar, then select the text to change. Double-click Paint format to apply it to several places, and click it again to stop.",
      ] },
      { heading: "Paste from ChatGPT, Claude and other Markdown sources", paragraphs: [
        "Text copied with an AI chat’s copy button is often Markdown, so it arrives in Google Docs with ** and # symbols instead of bold and headings. Google Docs can convert it: turn on Tools > Preferences > Enable Markdown, then right-click in the document and choose Paste from Markdown.",
        "Alternatively, select the rendered answer on the page instead of using the copy button: that copies rich text, which normal Paste keeps. TypeWit’s visual editor also accepts rich text from the clipboard, so check the styles there before approving a session.",
      ] },
      { heading: "If Google Docs paste still loses your styles", paragraphs: [
        "Copy directly from the formatted original. Passing text through a plain-text editor or a text-only field can strip styles before Google Docs receives it. Test a simple bold phrase first to separate a clipboard problem from a complex document-layout problem.",
        "If a right-click or menu paste is blocked, use the keyboard shortcut while the document is editable and focused. Clipboard permissions and browser restrictions can affect menu access. Google notes that shortcuts can also vary with the keyboard or language.",
        "Check where you pasted: text added inside an existing paragraph or list may interact with that paragraph’s style. Try a new paragraph and inspect the result. For complete page-layout fidelity, open or import the original file instead of expecting ordinary clipboard paste to reproduce everything.",
      ] },
      { heading: "Paste formatted text into TypeWit", paragraphs: [
        "For scheduled entry, paste into TypeWit’s visual editor instead of the document. Supported styles are included on Free, without adding Markdown markers.",
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
        "Use scheduled entry only for authorized tests, and inspect the completed document before sharing.",
      ] },
    ], sources: [
      { label: "Google Docs keyboard shortcuts", url: "https://support.google.com/docs/answer/179738" },
      { label: "Google Workspace Updates: import and export Markdown in Google Docs", url: "https://workspaceupdates.googleblog.com/2024/07/import-and-export-markdown-in-google-docs.html" },
    ],
  },
  {
    slug: "google-docs-version-history", published: "2026-10-21", updated: "2026-11-08", title: "Google Docs Version History and Automated Edits",
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
        "Download the session log to check approval, planned and confirmed entry, pauses, retries and errors. It can explain what TypeWit did even when Google groups changes together.",
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
      { heading: "Pro playback and the optional final revision pass", paragraphs: [
        "Pro playback replays only TypeWit’s confirmed actions in a read-only preview. Its timeline uses the saved planned schedule; it does not edit the document or recreate Google’s official snapshots. Every plan keeps the activity log.",
        "The optional final revision pass briefly edits only the session-owned suffix, then restores the approved text. It does not rewrite ideas or alter collaborators’ text. Let temporary corrections finish before sharing.",
      ] },
    ], sources: [{ label: "Google Docs: find what changed, grouped versions and named versions", url: "https://support.google.com/docs/answer/190843" }],
  },
  {
    slug: "auto-typer-extension-vs-cloud", published: "2026-10-22", updated: "2026-11-08",
    title: "Auto Typer Extension vs. Cloud for Google Docs",
    description: "Compare browser-extension auto typers with cloud text entry for Google Docs: what keeps running when you close the laptop, permissions, formatting and limits.",
    summary: "A Google Docs auto typer either runs in your browser as an extension or on a server through Google’s API. The difference decides whether you can close your laptop, what you install, and what the tool can access.",
    sections: [
      { heading: "Two ways to type into Google Docs automatically", paragraphs: [
        "An extension operates in your browser, usually requiring the Google Docs tab and computer to stay awake. Check the individual tool’s requirements.",
        "Cloud entry uses a server and Google authorization. TypeWit follows this model for Google Docs; its Word add-in has a different execution requirement.",
      ] },
      { heading: "Side by side", paragraphs: [
        "Neither approach is right for everyone. These are the practical differences to check before choosing a tool, whichever product you use.",
      ], steps: [
        "Keeps running after you close the laptop: usually not with an extension; yes with cloud entry.",
        "What you install: an extension with permission to read and change the sites it runs on, versus no install for cloud entry, only a Google permission for specific documents.",
        "Devices: extensions need a desktop browser that supports them; cloud entry can be started and controlled from any modern browser, including a phone or Chromebook.",
        "Formatting: depends on the tool. TypeWit keeps supported headings, bold, italic, bullets and highlights from a normal paste.",
        "Control: check for pause, resume and stop, and for a log of what was entered and when.",
      ] },
      { heading: "Permissions are worth reading", paragraphs: [
        "When you install an extension, Chrome shows the sites and data it can read and change. Read it before installing, and remove extensions you no longer use.",
        "With cloud entry, the service holds a Google authorization for your account. TypeWit uses Google’s drive.file permission, so it can open only the documents it creates and those you choose in Google’s file picker, not the rest of your Drive. You can disconnect the account at any time from Connected accounts.",
      ] },
      { heading: "When a browser extension is the better fit", paragraphs: [
        "If you only need short, one-off entry while you watch the document, an extension can be quicker to try. It also works in editors that have no public API.",
        "For overnight entry or control from another device, compare cloud scheduling and recovery options. Also check where your text is processed and how authorization can be withdrawn.",
      ] },
      { heading: "Use either responsibly", paragraphs: [
        "Both approaches automate typing. Neither proves that a person wrote a document or how long it took, whatever the rhythm looks like in version history.",
      ] },
    ], sources: [
      { label: "Google Drive API: choose scopes (drive.file)", url: "https://developers.google.com/workspace/drive/api/guides/api-specific-auth" },
      { label: "Chrome: what extension permissions allow", url: "https://developer.chrome.com/docs/extensions/reference/permissions-list" },
    ],
  },
  {
    slug: "auto-type-text-microsoft-word", published: "2026-10-22", updated: "2026-11-08",
    title: "Auto Typer for Word: Built-In Tools vs Add-Ins",
    description: "Need an auto typer for Microsoft Word? Compare Word’s AutoCorrect, Quick Parts and Dictate with an add-in like TypeWit for paced entry of prepared text.",
    summary: "Word already has tools that insert text for you. Use AutoCorrect or Quick Parts for snippets you reuse, Dictate to speak instead of type, and an add-in like TypeWit when approved text should be entered over time.",
    sections: [
      { heading: "Pick the tool for the job", paragraphs: [
        "“Auto typing” means different things. Inserting the same signature or paragraph often is a snippet job. Turning speech into text is dictation. Entering a prepared passage gradually, at a pace you set, is paced entry. Word handles the first two on its own.",
      ] },
      { heading: "Reusable snippets: AutoCorrect and Quick Parts", paragraphs: [
        "AutoCorrect replaces a short code you type, such as an abbreviation, with a longer entry as soon as you press Space or Enter. Quick Parts (AutoText) saves a selected block, including its formatting, so you can insert it from the Insert tab or by typing its name and pressing F3 in Word for Windows.",
        "The steps below apply to Quick Parts in Word for Windows. For other Word versions, check Microsoft’s reusable-snippet guide.",
      ], steps: [
        "Select the text you want to reuse.",
        "On the Insert tab, choose Quick Parts, then Save Selection to Quick Part Gallery (or AutoText), and give it a name.",
        "Insert it later from Quick Parts, or type the name and press F3.",
      ] },
      { heading: "Speak instead of typing: Dictate", paragraphs: [
        "Dictate converts speech to text in Word with a Microsoft 365 subscription. Choose Home → Dictate, allow the microphone, and speak; say punctuation such as “comma” or “new line”. It types what you say as you say it.",
        "If you dictate into another app first, you can paste the result into TypeWit, review it and then enter it at a chosen pace.",
      ] },
      { heading: "Enter prepared text over time: the TypeWit add-in", paragraphs: [
        "Use the TypeWit add-in when a prepared passage should arrive gradually. Paste supported formatted text, choose a duration and review it before approval. The session controls let you pause or stop.",
        "Word entry runs inside the open add-in, so nothing is entered while the document or the panel is closed. Google Docs sessions are different: they run in the cloud.",
        "Setup takes a few minutes: the Word auto typer page walks through adding the add-in to Word on the web, and an administrator can deploy it to Word for Windows and Mac.",
      ] },
      { heading: "Keep it honest", paragraphs: [
        "Automated entry is still automation. Don’t use it to misrepresent who wrote a document or how it was drafted, and follow the rules of your school or workplace.",
      ] },
    ], sources: [
      { label: "Microsoft: create reusable text snippets (AutoCorrect and Quick Parts)", url: "https://support.microsoft.com/office/create-reusable-text-snippets-0bc40cab-f49c-4e06-bcb2-cd43c1674d1b" },
      { label: "Microsoft: dictate in Microsoft 365", url: "https://support.microsoft.com/office/dictate-in-microsoft-365-eab203e1-d030-43c1-84ef-999b0b9675fe" },
    ],
  },
  {
    slug: "voice-typing-google-docs", published: "2026-10-22", updated: "2026-11-08",
    title: "Google Docs Voice Typing and Hands-Free Entry",
    description: "Turn on Google Docs voice typing, check dictated text and see when scheduled entry helps. Includes keyboard and screen-reader tips.",
    summary: "Use Tools → Voice typing to dictate directly into Google Docs. If you want to edit a dictated draft before scheduled entry, use a separate speech app and review the result in TypeWit.",
    sections: [
      { heading: "Turn on voice typing in Google Docs", paragraphs: [
        "Google Docs voice typing works on a computer in current Chrome, Edge and Safari browsers. Your organization’s administrator may disable it. Open a document, choose Tools → Voice typing (or press Ctrl+Shift+S, ⌘+Shift+S on Mac), click the microphone, and start speaking. Say punctuation such as “period” or “new line”.",
        "Google’s help page lists the supported languages and commands, including editing and formatting commands in some languages.",
      ] },
      { heading: "When dictating straight into the document isn’t ideal", paragraphs: [
        "You might prefer to dictate on your phone, use another speech app, or tidy the text before it reaches the document. You might also want long text entered gradually rather than in one paste, or need to step away while it’s entered.",
        "In those cases, dictate anywhere, paste the result into TypeWit, and review it. TypeWit only enters text after you approve it.",
      ] },
      { heading: "Hands-free entry with TypeWit", paragraphs: [], steps: [
        "Dictate with your device’s voice input or any speech app, then copy the text.",
        "In TypeWit, open New session and paste it. Check the words and any headings, bold, italic or bullets.",
        "Choose a new Google Doc or an existing one, pick a rhythm, and set when it should finish.",
        "Approve and start. The session runs in the cloud, so you can close the page; pause or stop it from any device.",
      ] },
      { heading: "Built for keyboard and screen-reader use", paragraphs: [
        "You can run TypeWit entirely from the keyboard or with a screen reader, with large targets in light or dark mode. Progress can be announced to screen readers every 10%, and status changes such as paused or finished are always announced. You can turn the progress announcements off.",
      ] },
      { heading: "Review dictated text before entry", paragraphs: [
        "Check names, punctuation and paragraph breaks after dictation. Voice input may supply plain text without headings or emphasis; add supported styles in the editor, then approve the exact passage you want entered.",
      ] },
    ], sources: [{ label: "Google Docs: type with your voice", url: "https://support.google.com/docs/answer/4492226" }],
  },
];

/** Task-related reading instead of repeating the entire guide catalogue on every article. */
export const RELATED_GUIDES: Record<string, string[]> = {
  "choose-google-docs-auto-typer": ["auto-typer-extension-vs-cloud", "schedule-text-google-docs", "paste-text-keep-formatting-google-docs"],
  "schedule-text-google-docs": ["google-docs-version-history", "paste-text-keep-formatting-google-docs", "auto-typer-extension-vs-cloud"],
  "paste-text-keep-formatting-google-docs": ["choose-google-docs-auto-typer", "schedule-text-google-docs", "auto-type-text-microsoft-word"],
  "google-docs-version-history": ["schedule-text-google-docs", "choose-google-docs-auto-typer", "auto-typer-extension-vs-cloud"],
  "auto-typer-extension-vs-cloud": ["choose-google-docs-auto-typer", "schedule-text-google-docs", "google-docs-version-history"],
  "auto-type-text-microsoft-word": ["voice-typing-google-docs", "paste-text-keep-formatting-google-docs"],
  "voice-typing-google-docs": ["paste-text-keep-formatting-google-docs", "auto-type-text-microsoft-word"],
};

/** When each public page last changed substantively; the sitemap's lastmod. Pages not listed use CONTENT_UPDATED. */
export const PAGE_UPDATED: Record<string, string> = {
  "/support/": "2026-11-14",
  "/terms/": "2026-10-31", "/privacy/": "2026-11-05", "/cookies/": "2026-10-31", "/subprocessors/": "2026-10-31", "/pricing/": "2026-11-14",
  "/about/": "2026-11-14", "/": "2026-11-14", "/how-it-works/":"2026-11-14", "/faq/":"2026-11-14", "/google-docs-auto-typer/": "2026-11-14", "/word-auto-typer/": "2026-11-14", "/guides/": "2026-11-08",
  ...Object.fromEntries(GUIDES.map(g => [`/guides/${g.slug}/`, g.updated])),
};

export const PUBLIC_PAGES = [
  "/", "/about/", "/how-it-works/", "/faq/", "/google-docs-auto-typer/", "/word-auto-typer/", "/guides/", ...GUIDES.map(g => `/guides/${g.slug}/`),
  "/pricing/", "/support/", "/responsible-use/", "/privacy/", "/terms/", "/cookies/", "/subprocessors/",
];

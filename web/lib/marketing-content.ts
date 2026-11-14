import { Icon } from "@/components/Icons";

export const USES = [
  { title: "Document workflow testing", text: "Test scheduled text entry in a document you own or have permission to use, then check each confirmed step in the activity log." },
  { title: "Formatting checks", text: "Bring a formatted sample and see how headings, emphasis, lists and highlights arrive in the document you chose." },
  { title: "Pacing experiments", text: "Compare Natural and Steady, or use paid controls to try longer blocks, rests and custom pacing." },
  { title: "Accessible document entry", text: "Dictate or prepare your draft with the tools you already use, then paste, approve and control entry by keyboard or screen reader." },
];

export const STEPS = [
  {
    icon: Icon.doc,
    title: "Paste your text",
    text:
      "Paste your draft into the editor, or dictate it with your device’s voice input first. Headings, bold, italic, lists and highlights stay as you pasted them, and you see exactly what will be entered before anything reaches the document.",
  },
  {
    icon: Icon.sliders,
    title: "Choose a rhythm",
    text:
      "Pick Natural for varied timing with short pauses, Steady for an even pace, or Pro’s Drafting rhythm. Then set when entry should finish, from a few minutes to an hour on Free, a day with a Day Pass or a week on Pro.",
  },
  {
    icon: Icon.play,
    title: "Review and start",
    text:
      "Choose a new or existing Google Doc, or open Word with the add-in, check the text once more and approve. Follow progress, pause, resume or stop from any device, and download the activity log when it’s done.",
  },
];

export const FEATURES = [
  {
    icon: Icon.check,
    title: "You approve every word",
    text:
      "Review the text before starting. Changes need fresh approval; enabled temporary corrections finish during entry.",
  },
  {
    icon: Icon.clock,
    title: "Your pace",
    text:
      "Start with sentence steps, or choose word groups and paragraphs. Set a duration within your plan’s limit.",
  },
  {
    icon: Icon.pause,
    title: "Pause, resume or stop",
    text:
      "Control any session from your phone or computer, whenever you need to.",
  },
  {
    icon: Icon.list,
    title: "A clear record",
    text: "Every step is in the session’s activity log, ready to download.",
  },
  {
    icon: Icon.hand,
    title: "Accessible by default",
    text:
      "Works with the keyboard alone and with screen readers, in light and dark mode.",
  },
  {
    icon: Icon.lock,
    title: "Private by design",
    text:
      "Google access is limited to created or selected files. TypeWit does not use submitted text to train AI.",
  },
];

export const FAQ = [
  {
    q: "Is there a free plan?",
    a: "Yes. Free includes 250 words a day, sessions up to 60 minutes, Natural and Steady rhythms, single-word, word-group and sentence entry, and every accessibility feature. No card is needed. Compare Day Pass and Pro on the pricing page.",
  },
  {
    q: "Is using TypeWit cheating?",
    a: "TypeWit is for authorized testing of automated text entry. Optional rhythms simulate timing, temporary typos and corrections; they are not evidence of human authorship. Academic cheating, fabricated writing histories and deceptive authorship claims are prohibited.",
  },
  {
    q: "Does it work with Microsoft Word?",
    a: "Yes, through the TypeWit add-in: install it yourself in Word on the web, or ask your administrator to deploy it to Word for Windows and Mac. Word sessions run while the document and the TypeWit panel are open.",
  },
  {
    q: "Can TypeWit see my other Google Drive files?",
    a: "No. It only has access to the Google Docs it creates for you and the ones you choose in Google's file picker (the drive.file permission).",
  },
  {
    q: "Do I need to keep the page open?",
    a: "Not for Google Docs: sessions run on TypeWit's servers, so you can close the tab or turn off your computer. For Word, keep the document and the TypeWit panel open.",
  },
  {
    q: "Can I use it with dictation?",
    a: "Yes. Use your device’s voice input or another dictation app, then paste and review the result. TypeWit handles the scheduled entry, not speech recognition.",
  },
  { q: "Is TypeWit the same as Typewise?", a: "No. TypeWit (typewit.com) enters text you have already written into Google Docs and Microsoft Word on a schedule. It is not related to Typewise, the AI keyboard app." },
  { q: "What does the Day Pass include?", a: "For $3.99 once, with no renewal: 24 hours of unlimited words, one active session, sessions up to 24 hours within that time, writing hours and custom writing blocks. Pro adds scheduled starts, the Drafting rhythm and sessions up to a week." },
  { q: "Will pasted formatting survive?", a: "Headings, bold, italic, lists, alignment and highlights are kept when you paste into TypeWit's editor, on every plan. Images, tables, fonts and page layout are not reproduced." },
  { q: "Can I sign in with Discord?", a: "Yes. Choose Continue with Discord and complete the account checks. Connect Google separately in Connected accounts. To use Word, set a password in Settings for add-in sign-in." },
];

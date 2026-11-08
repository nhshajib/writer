import { Icon } from "@/components/Icons";

export const USES = [
  "Document workflow testing",
  "Formatting checks",
  "Pacing experiments",
  "Accessible document entry",
];

export const STEPS = [
  {
    icon: Icon.doc,
    title: "Paste your text",
    text:
      "Paste your draft, or use your device’s dictation. Check supported styles in the visual editor.",
  },
  {
    icon: Icon.sliders,
    title: "Choose a rhythm",
    text:
      "Choose Natural, Steady or Pro’s Drafting rhythm, then set when entry should finish.",
  },
  {
    icon: Icon.play,
    title: "Review and start",
    text:
      "Select your document, check the text and approve. Follow progress from the dashboard.",
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
    a: "Yes. Free includes 250 words a day, sessions up to 60 minutes, Natural and Steady rhythms, all insertion modes and accessibility features. No card is needed. Compare Day Pass and Pro on the pricing page.",
  },
  {
    q: "Is using TypeWit cheating?",
    a: "TypeWit is for authorized testing of automated text entry. Optional rhythms simulate timing, temporary typos and corrections; they are not evidence of human authorship. Academic cheating, fabricated writing histories and deceptive authorship claims are prohibited.",
  },
  {
    q: "Does it work with Microsoft Word?",
    a: "Yes. Add the TypeWit add-in to Word on the web (your organization can deploy it to Word for Windows and Mac). Word sessions run while the document and the TypeWit panel are open.",
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
  { q: "Can I sign in with Discord?", a: "Yes. Choose Continue with Discord and complete the account checks. Connect Google separately in Connected accounts. To use Word, set a password in Settings for add-in sign-in." },
];

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
      "Paste formatted text or dictate it. Headings, bold, italics, bullets and highlights come with it.",
  },
  {
    icon: Icon.sliders,
    title: "Choose a rhythm",
    text:
      "Natural or Steady, a finish time, and a new or existing document. Then read and approve the exact text.",
  },
  {
    icon: Icon.play,
    title: "Let it run",
    text:
      "TypeWit enters the text on schedule. Pause, resume or stop from any device; Google Docs keeps going when you close the tab.",
  },
];

export const FEATURES = [
  {
    icon: Icon.check,
    title: "You approve every word",
    text:
      "Sessions enter exactly the text you approved. Change it and you approve again.",
  },
  {
    icon: Icon.clock,
    title: "Your pace",
    text:
      "Word groups, sentences or paragraphs, spread over minutes, hours or up to a week.",
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
      "Opens only the documents it creates or you choose. Your text never trains AI.",
  },
];

export const FAQ = [
  { q: "Can I sign in with Discord?", a: "Yes. Choose Continue with Discord on Sign in or Join. New accounts still confirm their age and accept the agreement, and must use an eligible personal email address. Sign-in is separate from document access: connect Google Docs in Connected accounts, or set a password in Settings to sign in inside the Word add-in." },
  {
    q: "Is using TypeWit cheating?",
    a: "TypeWit is for authorized testing of automated text entry. Optional rhythms simulate timing, temporary typos and corrections; they are not evidence of human authorship. Academic cheating, fabricated writing histories and deceptive authorship claims are prohibited.",
  },
  {
    q: "Does it work with Microsoft Word?",
    a: "Yes. Add the TypeWit add-in to Word on the web (your organisation can deploy it to Word for Windows and Mac). Word sessions run while the document and the TypeWit panel are open.",
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
    a: "Yes. Dictate with your device's voice input (or any dictation app), paste the text into TypeWit, approve it, and choose the pace.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Free includes 250 words a day and sessions up to 60 minutes, with every insertion mode and accessibility feature, and no card needed. A $4.99 Day Pass removes the word limit for 24 hours with no subscription. Pro adds week-long sessions, custom pacing, saved presets and scheduled starts, with 7 days free.",
  },
];

/**
 * Responsible Use Agreement. Users read and accept it at sign-up; the version
 * is stored on their profile and the server refuses to write for anyone who
 * hasn't accepted the current one. Must match supabase/functions/_shared/terms.ts.
 */
export const CURRENT_TERMS_VERSION = "2026-10-17";

export interface TermsSection {
  heading: string;
  points: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: "What Writer is for",
    points: [
      "Writer is an assistive tool. It enters text you provide or approve into your own documents, for people who find typing difficult, slow or painful.",
      "Writer adds text in sentence, paragraph or larger steps. It does not imitate a person typing and does not try to make automated input look like manual typing.",
    ],
  },
  {
    heading: "Your text",
    points: [
      "Only use Writer with text you wrote yourself, or text you have the right to use and submit.",
      "You review and approve the exact text before Writer enters it. If the text changes, you approve it again.",
    ],
  },
  {
    heading: "School, work and other rules",
    points: [
      "Many schools, universities and employers have rules about assistive and automated tools. Some allow them as an accommodation, some require you to disclose them, and some restrict them for particular assignments.",
      "You are responsible for following the rules that apply to you. Where they require disclosure, disclose that you used Writer.",
      "If you use Writer as a disability accommodation, we recommend confirming it with your institution's disability or accessibility office.",
      "Do not use Writer to misrepresent who wrote something or how it was written.",
    ],
  },
  {
    heading: "Transparency",
    points: [
      "Writer records each approval and each insertion in your activity log, so you have a clear record of what was entered and when.",
      "Changes made by Writer are recorded in your document's version history by Google Docs as normal edits from your connected account.",
    ],
  },
  {
    heading: "Your account",
    points: [
      "One account per person. The free trial is available once per person.",
      "Sign up with a personal email address from a common provider. Temporary or disposable addresses aren't accepted.",
      "We may suspend accounts that break this agreement.",
    ],
  },
];

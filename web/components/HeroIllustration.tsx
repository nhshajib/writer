/**
 * TypeWit's own hero illustration: approved text arriving in a document,
 * sentence by sentence. Drawn inline so it follows the light and dark themes.
 * Decorative: the page around it describes the same thing in words.
 */
export function HeroIllustration({ className }: { className?: string }) {
  const ink = "var(--ill-ink)";
  const paper = "var(--ill-paper)";
  const line = "var(--ill-line)";
  const pending = "var(--ill-pending)";
  return (
    <svg className={className} viewBox="0 0 520 520" fill="none" aria-hidden="true" focusable="false">
      {/* Shadow card behind the page */}
      <rect x="150" y="92" width="270" height="350" rx="20" fill="var(--g-blue)" opacity="0.18" transform="rotate(6 285 267)" />

      {/* The document */}
      <g>
        <path d="M128 78h208l58 58v290a18 18 0 0 1-18 18H128a18 18 0 0 1-18-18V96a18 18 0 0 1 18-18z" fill={paper} stroke={ink} strokeWidth="3" />
        <path d="M336 78v40a18 18 0 0 0 18 18h40" fill="var(--g-blue)" fillOpacity="0.15" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        {/* Title */}
        <rect x="140" y="112" width="132" height="14" rx="7" fill={ink} />
        <rect x="140" y="136" width="76" height="8" rx="4" fill={pending} />
        {/* Sentences already entered */}
        <rect x="140" y="172" width="220" height="9" rx="4.5" fill={line} />
        <rect x="140" y="192" width="200" height="9" rx="4.5" fill={line} />
        <rect x="140" y="212" width="228" height="9" rx="4.5" fill={line} />
        <rect x="140" y="232" width="150" height="9" rx="4.5" fill={line} />
        {/* The sentence arriving now, highlighted, with the cursor */}
        <rect x="134" y="256" width="236" height="44" rx="10" fill="var(--g-blue)" fillOpacity="0.16" />
        <rect x="140" y="264" width="216" height="9" rx="4.5" fill="var(--g-blue)" />
        <rect x="140" y="283" width="120" height="9" rx="4.5" fill="var(--g-blue)" />
        <rect className="caret" x="266" y="279" width="3.5" height="17" rx="1.75" fill={ink} />
        {/* Still to come */}
        <rect x="140" y="320" width="210" height="9" rx="4.5" fill={pending} />
        <rect x="140" y="340" width="186" height="9" rx="4.5" fill={pending} />
        <rect x="140" y="360" width="220" height="9" rx="4.5" fill={pending} />
        <rect x="140" y="380" width="132" height="9" rx="4.5" fill={pending} />
      </g>

      {/* Dictation bubble */}
      <g>
        <path d="M376 34h86a20 20 0 0 1 20 20v46a20 20 0 0 1-20 20h-38l-20 18v-18h-28a20 20 0 0 1-20-20V54a20 20 0 0 1 20-20z" fill={paper} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <rect x="408" y="50" width="22" height="36" rx="11" fill="var(--g-red)" stroke={ink} strokeWidth="2.5" />
        <path d="M398 74a21 21 0 0 0 42 0M419 95v8" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M454 60c5 6 5 18 0 24M376 60c-5 6-5 18 0 24" stroke="var(--g-red)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </g>

      {/* Approval card */}
      <g>
        <rect x="26" y="190" width="150" height="74" rx="16" fill={paper} stroke={ink} strokeWidth="3" />
        <circle cx="62" cy="227" r="18" fill="var(--g-green)" stroke={ink} strokeWidth="2.5" />
        <path d="M53 227l6 6 12-13" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="90" y="214" width="66" height="9" rx="4.5" fill={ink} />
        <rect x="90" y="232" width="48" height="8" rx="4" fill={pending} />
      </g>

      {/* Progress card */}
      <g>
        <rect x="312" y="394" width="186" height="78" rx="16" fill={paper} stroke={ink} strokeWidth="3" />
        <rect x="330" y="412" width="90" height="9" rx="4.5" fill={ink} />
        <rect x="330" y="434" width="150" height="10" rx="5" fill={pending} />
        <rect x="330" y="434" width="94" height="10" rx="5" fill="var(--g-blue)" />
        <circle cx="468" cy="416" r="9" fill="var(--g-yellow)" stroke={ink} strokeWidth="2.5" />
        <rect x="330" y="452" width="60" height="7" rx="3.5" fill={pending} />
      </g>

      {/* Plant */}
      <g>
        <path d="M44 420c-6-34 8-62 28-76M72 396c10-26 32-38 50-38M58 404c-20-12-40-10-52-2" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M72 344c-18 4-28 22-22 40 16-4 26-20 22-40z" fill="var(--g-green)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M122 358c-20-6-40 6-44 24 18 4 38-6 44-24z" fill="var(--g-blue)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M6 402c12-14 34-16 46-4-12 12-34 14-46 4z" fill="var(--g-green)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M30 420h60l-8 56H38z" fill={ink} />
        <rect x="24" y="412" width="72" height="14" rx="5" fill={ink} />
      </g>

      {/* Desk line */}
      <path d="M8 478h504" stroke={ink} strokeWidth="3" strokeLinecap="round" />

      {/* Small accents */}
      <circle cx="96" cy="120" r="7" fill="var(--g-yellow)" stroke={ink} strokeWidth="2.5" />
      <circle cx="470" cy="300" r="6" fill="var(--g-red)" stroke={ink} strokeWidth="2.5" />
      <path d="M454 196l14 14M468 196l-14 14" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

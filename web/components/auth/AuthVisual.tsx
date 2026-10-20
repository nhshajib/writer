"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { Logo } from "@/components/Logo";

const SLIDES = [
  {
    title: "Your words, entered for you.",
    body: "Approve your text once. TypeWit adds it to your Google Doc or Word document, step by step, at the pace you choose.",
  },
  {
    title: "Pause, resume or stop any time.",
    body: "Every session runs on its own schedule. Check its progress, take a break, or stop it from any device.",
  },
  {
    title: "Made for people who find typing hard.",
    body: "Large targets, full keyboard and screen-reader support, and no time pressure. Always labelled as automated text entry.",
  },
];

const LINES = [
  "The river rose overnight.",
  "By morning the lower fields",
  "were under water. Neighbours",
  "came with boats, and nobody",
  "knew how long it would last.",
];

/** The left half of the sign-in pages: a document filling in, and what TypeWit does. Decorative apart from the slides. */
export function AuthVisual() {
  const pathname = usePathname().replace(/\/$/, "");
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const onSignup = pathname === "/signup";

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 7000);
    return () => clearInterval(timer);
  }, [paused]);

  const go = (step: number) => setSlide((s) => (s + step + SLIDES.length) % SLIDES.length);

  return (
    <div className="auth-visual">
      <div className="auth-visual-top">
        <Link href="/" className="auth-visual-brand"><Logo /><span>Type<span>Wit</span></span></Link>
        <nav aria-label="Site" className="auth-visual-nav">
          <Link href="/pricing">Pricing</Link>
          <Link href={onSignup ? "/login" : "/signup"} className="pill">{onSignup ? "Sign in" : "Create account"}</Link>
        </nav>
      </div>

      <div className="scene" aria-hidden="true">
        <div className="glow" />
        <div className="doc-wrap">
        <div className="doc-sheet">
          <div className="doc-bar"><span className="doc-dot" /><span className="doc-name">History essay</span></div>
          <p className="doc-heading">The 1953 flood</p>
          {LINES.map((line, i) => (
            <p key={line} className="doc-line" style={{ "--i": i } as React.CSSProperties}>{line}</p>
          ))}
          <span className="doc-cursor" />
        </div>
        <div className="tw-card">
          <div className="tw-row">
            <span className="tw-live"><span className="tw-pulse" />Running</span>
            <span className="tw-muted">Part 5 of 8</span>
          </div>
          <div className="tw-bar"><span /></div>
          <div className="tw-row">
            <span className="tw-muted">Next part in</span>
            <span className="tw-time">0:42</span>
          </div>
        </div>
        <div className="tw-chip"><Icon.pause />Pause any time</div>
        </div>
      </div>

      <div className="auth-slides" ref={region} aria-roledescription="carousel" aria-label="What TypeWit does"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
        <div className="auth-slide" aria-live={paused ? "polite" : "off"}>
          <p className="auth-slide-title">{SLIDES[slide].title}</p>
          <p className="auth-slide-body">{SLIDES[slide].body}</p>
        </div>
        <div className="auth-slide-controls">
          <div className="auth-dots" aria-hidden="true">
            {SLIDES.map((_, i) => <span key={i} data-on={i === slide} />)}
          </div>
          <button type="button" className="round-btn" onClick={() => go(-1)}><Icon.arrowRight /><span className="sr-only">Previous</span></button>
          <button type="button" className="round-btn" onClick={() => go(1)}><Icon.arrowRight /><span className="sr-only">Next</span></button>
        </div>
      </div>
    </div>
  );
}

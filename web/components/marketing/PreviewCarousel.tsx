"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icons";
import { LivePreview } from "@/components/marketing/LivePreview";

const CAPTIONS = ["Watch it enter your text", "Approve the exact words", "Set your pace"];

/**
 * App previews. On phones they scroll sideways, one screen at a time; on larger screens only the
 * first (the example session) is shown. Slides 2 and 3 are pictures of the real screens.
 */
export function PreviewCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const slide = el.firstElementChild as HTMLElement | null;
      if (!slide) return;
      setCurrent(Math.round(el.scrollLeft / (slide.offsetWidth + 12)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function show(i: number) {
    const slide = track.current?.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "start" });
  }

  return (
    <div className="pc">
      <div className="pc-track" ref={track} role="region" aria-label="App previews" tabIndex={0}>
        <div className="pc-slide" role="group" aria-label={`Preview 1 of 3: ${CAPTIONS[0]}`}>
          <LivePreview />
          <p className="pc-cap">{CAPTIONS[0]}</p>
        </div>
        <div className="pc-slide pc-more" role="group" aria-label={`Preview 2 of 3: ${CAPTIONS[1]}`}>
          <div className="pc-screen" aria-hidden="true">
            <p className="pc-screen-title">Review and approve</p>
            <p className="pc-text">
              Rural communities face unique challenges in accessing healthcare. Telehealth can help reduce these barriers
              and increase access to care.
            </p>
            <div className="pc-check"><span className="pc-box"><Icon.check /></span>I&apos;ve read this exact text and approve it.</div>
            <div className="pc-btn">Start session</div>
          </div>
          <p className="pc-cap">{CAPTIONS[1]}</p>
        </div>
        <div className="pc-slide pc-more" role="group" aria-label={`Preview 3 of 3: ${CAPTIONS[2]}`}>
          <div className="pc-screen" aria-hidden="true">
            <p className="pc-screen-title">How it&apos;s entered</p>
            <ul className="pc-rows">
              <li><span>Sentences</span><Icon.check /></li>
              <li><span>Words</span></li>
              <li><span>Paragraphs</span></li>
            </ul>
            <ul className="pc-rows">
              <li><span>Total duration</span><em>1 hour</em></li>
            </ul>
          </div>
          <p className="pc-cap">{CAPTIONS[2]}</p>
        </div>
      </div>
      <div className="pc-dots">
        {CAPTIONS.map((c, i) => (
          <button key={c} type="button" aria-label={`Show preview ${i + 1} of 3`} aria-current={current === i ? "true" : undefined} onClick={() => show(i)} />
        ))}
      </div>
    </div>
  );
}

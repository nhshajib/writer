"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * On phones, the main action stays at hand in a bottom bar once the top "Get started" button has
 * scrolled away, and steps aside when the footer arrives.
 */
export function GetStartedBar() {
  const [heroGone, setHeroGone] = useState(false);
  const [footerIn, setFooterIn] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const footer = document.querySelector(".site-footer");
    const observers: IntersectionObserver[] = [];
    if (hero) {
      const o = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0));
      o.observe(hero);
      observers.push(o);
    }
    if (footer) {
      const o = new IntersectionObserver(([e]) => setFooterIn(e.isIntersecting));
      o.observe(footer);
      observers.push(o);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const shown = heroGone && !footerIn;
  return (
    <div className="get-bar" data-shown={shown || undefined} inert={!shown}>
      <Link href="/signup/" className="btn btn-primary btn-lg btn-block">Get started free</Link>
      <p>Free plan · No card needed</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/** Phone layout below 768px; matches the CSS breakpoint for the tab bar. */
export const MOBILE_QUERY = "(max-width: 767px)";

/** Whether a media query matches, kept up to date. False until mounted (the app renders only in the browser). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

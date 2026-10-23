"use client";
import { useEffect } from "react";

/** Keep fixed app chrome out of the way of the software keyboard. No device sniffing. */
export function MobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const active = document.activeElement;
      const editing = active instanceof HTMLElement && (active.isContentEditable || active.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea'));
      document.documentElement.toggleAttribute("data-keyboard-open", Boolean(editing && window.innerHeight - viewport.height > 150));
    };
    const afterBlur = () => queueMicrotask(update);
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", afterBlur);
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", afterBlur);
      document.documentElement.removeAttribute("data-keyboard-open");
    };
  }, []);
  return null;
}

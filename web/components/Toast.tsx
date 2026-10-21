"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "@/components/Icons";

type Show = (message: string) => void;

const ToastContext = createContext<Show>(() => {});

/** A short confirmation that an action worked ("Saved."), announced politely and gone after a few seconds. */
export function useToast(): Show {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<Show>((text) => {
    window.clearTimeout(timer.current);
    // Clear first so the same message twice is announced twice.
    setMessage(null);
    window.setTimeout(() => setMessage(text), 30);
    timer.current = window.setTimeout(() => setMessage(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && (
          <div className="toast">
            <span>{message}</span>
            <button type="button" className="icon-btn toast-close" onClick={() => setMessage(null)} aria-label="Dismiss"><Icon.close /></button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

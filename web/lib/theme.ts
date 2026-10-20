"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_KEY as KEY } from "./themeScript";

export type Theme = "system" | "light" | "dark";

/** The person's Light / Dark / System choice, kept in this browser. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setThemeState(saved);
    } catch { /* storage unavailable: follow the system */ }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* storage unavailable: the choice lasts for this page */ }
  }, []);

  return [theme, setTheme];
}

/** Only this device's TypeWit drafts/preferences; retain the short age-abuse marker. */
export function clearDeletedAccountBrowserData(): void {
  if (typeof window === "undefined") return;
  const keys = ["typewit.draft", "typewit.rhythm", "typewit.pace", "typewit.theme", "typewit.announceProgress",
    "typewit-google-connect-verifier", "typewit:age-before-google", "typewit:agreed-before-google"];
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      for (const key of keys) window[name].removeItem(key);
    } catch { /* Blocked device storage must not undo a completed server deletion. */ }
  }
}

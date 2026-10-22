/** Whether screen readers hear every 10% of a session's progress; status changes are always announced. Kept in this browser. */
const ANNOUNCE_KEY = "typewit.announceProgress";

export function readAnnounceProgress(): boolean {
  try {
    return localStorage.getItem(ANNOUNCE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeAnnounceProgress(on: boolean) {
  try {
    localStorage.setItem(ANNOUNCE_KEY, on ? "on" : "off");
  } catch { /* storage unavailable: the choice lasts for this page */ }
}

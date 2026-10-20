/** Where the Light / Dark choice is kept in the browser. */
export const THEME_KEY = "typewit.theme";

/** Runs in <head> before the page paints: sets data-theme from the saved choice. */
export const THEME_SCRIPT =
  `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

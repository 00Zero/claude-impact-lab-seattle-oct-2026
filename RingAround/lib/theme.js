export const THEME_STORAGE_KEY = "ringaround:theme";

// Runs before first paint: default to dark and honor an explicitly saved light theme.
export const themeScript = `try{document.documentElement.dataset.theme=localStorage.getItem("${THEME_STORAGE_KEY}")==="light"?"light":"dark"}catch(e){}`;

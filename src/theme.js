const THEMES = {
  light: { bg: "#ffffff", border: "#d0d7de", text: "#1f2328", muted: "#59636e", track: "#e6eaef", a1: "#0969da", a2: "#8250df" },
  dark: { bg: "#0d1117", border: "#30363d", text: "#f0f6fc", muted: "#9198a1", track: "#262c36", a1: "#58a6ff", a2: "#bc8cff" },
};

export const THEME_NAMES = ["auto", "light", "dark"];

export const FONT = `-apple-system,"Segoe UI",Ubuntu,"Helvetica Neue",Arial,sans-serif`;

const cssVars = (t) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(";");

/** CSS custom properties for a theme; "auto" follows the viewer's colour scheme. */
export function themeCss(theme = "auto") {
  if (theme === "light" || theme === "dark") return `svg{${cssVars(THEMES[theme])}}`;
  return `svg{${cssVars(THEMES.light)}}@media(prefers-color-scheme:dark){svg{${cssVars(THEMES.dark)}}}`;
}

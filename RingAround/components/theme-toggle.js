"use client";

import { useSyncExternalStore } from "react";
import { MoonGlyph, SunGlyph } from "@/components/icons";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle() {
  // null until hydrated; the icon itself switches with CSS so it never flashes.
  const theme = useSyncExternalStore(subscribe, readTheme, () => null);

  function toggle() {
    const next = readTheme() === "dark" ? "light" : "dark";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Dark mode"
      aria-pressed={theme === null ? undefined : theme === "dark"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface/60 text-ink transition hover:border-ink"
    >
      <MoonGlyph className="h-4 w-4 dark:hidden" />
      <SunGlyph className="hidden h-4 w-4 dark:block" />
    </button>
  );
}

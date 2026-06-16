"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "dark" | "light";

// Shared key also appears in the early theme script in the root layout.
const storageKey = "cleartrend-theme";

// Return only values understood by the theme system.
function getStoredTheme(): Theme | null {
  // Server rendering has no window and therefore no persisted browser choice.
  if (typeof window === "undefined") {
    return null;
  }

  const storedTheme = window.localStorage.getItem(storageKey);

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return null;
}

function getSystemTheme(): Theme {
  // Light is a deterministic server-side fallback before hydration.
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeSwitch() {
  // Translation text describes the action, not merely the current state.
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // An explicit saved choice wins over the operating-system preference.
    const storedTheme = getStoredTheme();
    const resolvedTheme = storedTheme ?? getSystemTheme();

    if (storedTheme) {
      // data-theme activates the explicit CSS token set.
      document.documentElement.dataset.theme = storedTheme;
    } else {
      // Without data-theme, CSS falls back to prefers-color-scheme.
      delete document.documentElement.dataset.theme;
    }

    // Defer React state synchronization until after the initial DOM theme update.
    const frameId = window.requestAnimationFrame(() => {
      setTheme(resolvedTheme);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const isDark = theme === "dark";
  // The button always advertises and applies the opposite theme.
  const nextTheme = isDark ? "light" : "dark";

  function handleToggleTheme() {
    // Update the DOM immediately, then persist the explicit user preference.
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
  }

  return (
    // aria-pressed exposes the current binary state to assistive technology.
    <button
      aria-label={t("switchTo", {
        theme: t(nextTheme),
      })}
      aria-pressed={isDark}
      className="theme-switch"
      onClick={handleToggleTheme}
      type="button"
    >
      <span className="theme-switch-track">
        <span className="theme-switch-thumb">
          {isDark ? (
            <svg
              aria-hidden="true"
              className="theme-switch-icon"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 14.4A7.6 7.6 0 0 1 9.6 3a8.7 8.7 0 1 0 11.4 11.4Z"
                fill="currentColor"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="theme-switch-icon"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2.5" />
              <path
                d="M12 2.5v3M12 18.5v3M4.7 4.7l2.1 2.1M17.2 17.2l2.1 2.1M2.5 12h3M18.5 12h3M4.7 19.3l2.1-2.1M17.2 6.8l2.1-2.1"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}

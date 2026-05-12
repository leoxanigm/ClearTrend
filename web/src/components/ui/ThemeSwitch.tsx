"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "dark" | "light";

const storageKey = "cleartrend-theme";

function getStoredTheme(): Theme | null {
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
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeSwitch() {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = getStoredTheme();
    const resolvedTheme = storedTheme ?? getSystemTheme();

    if (storedTheme) {
      document.documentElement.dataset.theme = storedTheme;
    } else {
      delete document.documentElement.dataset.theme;
    }

    const frameId = window.requestAnimationFrame(() => {
      setTheme(resolvedTheme);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const isDark = theme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  function handleToggleTheme() {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
  }

  return (
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

"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "rd-theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initialTheme = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function chooseTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className="app-theme-toggle" aria-label="Theme selector">
      <button
        type="button"
        className={`app-theme-toggle__button${theme === "light" ? " is-active" : ""}`}
        onClick={() => chooseTheme("light")}
        aria-label="Use light mode"
        aria-pressed={theme === "light"}
        title="Light mode"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M10 1.8V4M10 16V18.2M18.2 10H16M4 10H1.8M15.8 4.2L14.2 5.8M5.8 14.2L4.2 15.8M15.8 15.8L14.2 14.2M5.8 5.8L4.2 4.2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className={`app-theme-toggle__button${theme === "dark" ? " is-active" : ""}`}
        onClick={() => chooseTheme("dark")}
        aria-label="Use dark mode"
        aria-pressed={theme === "dark"}
        title="Dark mode"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M16.3 12.5A6.6 6.6 0 0 1 7.5 3.7A6.9 6.9 0 1 0 16.3 12.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

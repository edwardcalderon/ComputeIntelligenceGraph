"use client";

import React from "react";
import { useTheme } from "../app/providers";
import { useTranslation } from "@cig-technology/i18n/react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
      className={`rounded-full p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 ${className}`}
    >
      {theme === "dark" ? (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" /><path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" /><path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </button>
  );
}

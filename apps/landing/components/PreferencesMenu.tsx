"use client";

import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@cig-technology/i18n/react";
import { SUPPORTED_LOCALES, LOCALE_META } from "@cig-technology/i18n";
import type { SupportedLocale } from "@cig-technology/i18n";
import { changeLocale } from "../app/i18n";
import { useTheme } from "../app/providers";

export function PreferencesMenu({ className = "" }: { className?: string }) {
  const { locale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Preferences"
        className="rounded-full p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 6V4"/>
          <path d="M16.24 7.76 17.66 6.34"/>
          <path d="M18 12h2"/>
          <path d="M16.24 16.24 17.66 17.66"/>
          <path d="M12 18v2"/>
          <path d="M6.34 17.66 7.76 16.24"/>
          <path d="M4 12H2"/>
          <path d="M6.34 6.34 7.76 7.76"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden animate-fade-in-fast z-50">
          {/* Language */}
          <div className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Language</div>
            <div className="flex flex-col">
              {SUPPORTED_LOCALES.map((loc) => (
                <button
                  key={loc}
                  onClick={() => { changeLocale(loc as SupportedLocale); setOpen(false); }}
                  className={`flex items-center justify-between w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    loc === locale
                      ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 font-medium"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{LOCALE_META[loc as SupportedLocale].nativeName}</span>
                  {loc === locale && (
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="px-3.5 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Theme</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setTheme("light"); setOpen(false); }}
                className={`px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  theme === "light" ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 font-medium" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                Light
              </button>
              <button
                onClick={() => { setTheme("dark"); setOpen(false); }}
                className={`px-2.5 py-2 rounded-lg text-sm transition-colors ${
                  theme === "dark" ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 font-medium" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

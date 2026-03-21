"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@cig-technology/i18n/react";
import { SUPPORTED_LOCALES, LOCALE_META } from "@cig-technology/i18n";
import type { SupportedLocale } from "@cig-technology/i18n";
import { changeLocale } from "../app/i18n";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
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
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-cig-muted hover:text-cig-secondary hover:bg-cig-hover transition-colors"
        aria-label={t("header.changeLanguage")}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl border border-cig bg-cig-card shadow-xl dark:shadow-black/30 overflow-hidden z-50">
          {SUPPORTED_LOCALES.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                changeLocale(loc as SupportedLocale);
                setOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-sm transition-colors ${
                loc === locale
                  ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 font-medium"
                  : "text-cig-secondary hover:bg-cig-hover"
              }`}
            >
              {LOCALE_META[loc as SupportedLocale].nativeName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

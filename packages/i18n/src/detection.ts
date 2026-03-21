/**
 * Locale detection strategies for different platforms.
 * Each returns the best matching SupportedLocale.
 */

import { isValidLocale } from "./core.js";
import { DEFAULT_LOCALE, type SupportedLocale } from "./types.js";

/**
 * Browser: checks URL param → cookie → <html lang> → navigator.language.
 */
export function detectBrowserLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const candidates = [
    new URLSearchParams(window.location.search).get("lang"),
    getCookie("cig-locale"),
    document.documentElement.lang?.split("-")[0],
    navigator.language?.split("-")[0],
    ...(navigator.languages ?? []).map((l) => l.split("-")[0]),
  ];

  for (const c of candidates) {
    if (c && isValidLocale(c)) return c;
  }
  return DEFAULT_LOCALE;
}

/**
 * Node/CLI: checks CIG_LOCALE → LANG → LC_ALL env vars.
 */
export function detectNodeLocale(): SupportedLocale {
  if (typeof process === "undefined") return DEFAULT_LOCALE;

  const candidates = [
    process.env["CIG_LOCALE"],
    process.env["LANG"]?.split(".")[0]?.split("_")[0],
    process.env["LC_ALL"]?.split(".")[0]?.split("_")[0],
    process.env["LANGUAGE"]?.split(":")[0]?.split("_")[0],
  ];

  for (const c of candidates) {
    if (c && isValidLocale(c)) return c;
  }
  return DEFAULT_LOCALE;
}

/**
 * React Native / Expo: pass device locale tags from expo-localization.
 *
 * @example
 * import * as Localization from "expo-localization";
 * const locale = detectMobileLocale(
 *   Localization.getLocales().map(l => l.languageTag)
 * );
 */
export function detectMobileLocale(
  deviceLocales: string[],
): SupportedLocale {
  for (const l of deviceLocales) {
    const base = l.split("-")[0];
    if (base && isValidLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * Persist the user's locale choice in a cookie (browser only).
 */
export function persistLocale(locale: SupportedLocale): void {
  if (typeof document === "undefined") return;
  document.cookie = `cig-locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
  document.documentElement.lang = locale;
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match?.[1];
}

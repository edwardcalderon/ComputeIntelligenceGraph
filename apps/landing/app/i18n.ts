"use client";

/**
 * Landing app i18n setup.
 *
 * Loads the shared + landing catalogs from @cig-technology/i18n
 * and configures the singleton with browser-detected locale.
 */

import { i18n } from "@cig-technology/i18n";
import { detectBrowserLocale, persistLocale } from "@cig-technology/i18n/detection";
import type { SupportedLocale } from "@cig-technology/i18n";

/* ─── Statically bundled catalogs ────────────────────────────────────── */
// We import the CIG catalogs from the monorepo workspace package directly.
// This avoids a network round-trip and gives us type-safe keys.

import sharedEn from "../../../packages/i18n/catalogs/shared/en.json";
import sharedEs from "../../../packages/i18n/catalogs/shared/es.json";
import sharedZh from "../../../packages/i18n/catalogs/shared/zh.json";

import landingEn from "../../../packages/i18n/catalogs/landing/en.json";
import landingEs from "../../../packages/i18n/catalogs/landing/es.json";
import landingZh from "../../../packages/i18n/catalogs/landing/zh.json";

/* ─── Load all catalogs eagerly ──────────────────────────────────────── */

const catalogs: Record<string, Record<SupportedLocale, Record<string, string>>> = {
  shared: { en: sharedEn, es: sharedEs, zh: sharedZh },
  landing: { en: landingEn, es: landingEs, zh: landingZh },
};

let initialized = false;

export function initI18n(): void {
  if (initialized) return;
  initialized = true;

  // Load all catalogs for all locales
  for (const [namespace, locales] of Object.entries(catalogs)) {
    for (const [locale, catalog] of Object.entries(locales)) {
      i18n.loadCatalog(namespace, locale as SupportedLocale, catalog);
    }
  }

  // Detect and activate browser locale
  const detected = detectBrowserLocale();
  i18n.setLocale(detected);
}

export function changeLocale(locale: SupportedLocale): void {
  i18n.setLocale(locale);
  persistLocale(locale);
}

export { i18n };

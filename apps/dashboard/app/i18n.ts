"use client";

/**
 * Dashboard app i18n setup.
 *
 * Loads the shared + dashboard catalogs from @cig-technology/i18n
 * and configures the singleton with the locale supplied by the app shell.
 */

import { DEFAULT_LOCALE, i18n, persistLocale, type SupportedLocale } from "@cig-technology/i18n";

/* ─── Statically bundled catalogs ────────────────────────────────────── */

import sharedEn from "../../../packages/i18n/catalogs/shared/en.json";
import sharedEs from "../../../packages/i18n/catalogs/shared/es.json";
import sharedZh from "../../../packages/i18n/catalogs/shared/zh.json";

import dashboardEn from "../../../packages/i18n/catalogs/dashboard/en.json";
import dashboardEs from "../../../packages/i18n/catalogs/dashboard/es.json";
import dashboardZh from "../../../packages/i18n/catalogs/dashboard/zh.json";

/* ─── Load all catalogs eagerly ──────────────────────────────────────── */

const catalogs: Record<string, Record<SupportedLocale, Record<string, string>>> = {
  shared: { en: sharedEn, es: sharedEs, zh: sharedZh },
  dashboard: { en: dashboardEn, es: dashboardEs, zh: dashboardZh },
};

let initialized = false;

export function initI18n(initialLocale: SupportedLocale = DEFAULT_LOCALE): void {
  if (!initialized) {
    initialized = true;

    for (const [namespace, locales] of Object.entries(catalogs)) {
      for (const [locale, catalog] of Object.entries(locales)) {
        i18n.loadCatalog(namespace, locale as SupportedLocale, catalog);
      }
    }
  }

  if (i18n.locale !== initialLocale) {
    i18n.setLocale(initialLocale);
  }
}

export function changeLocale(locale: SupportedLocale): void {
  i18n.setLocale(locale);
  persistLocale(locale);
}

export { i18n };

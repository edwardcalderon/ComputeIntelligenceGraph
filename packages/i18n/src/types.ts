/* ─── Locale definitions ──────────────────────────────────────────────── */

export const SUPPORTED_LOCALES = ["en", "es", "zh"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_META: Record<
  SupportedLocale,
  { name: string; nativeName: string; dir: "ltr" | "rtl" }
> = {
  en: { name: "English", nativeName: "English", dir: "ltr" },
  es: { name: "Spanish", nativeName: "Español", dir: "ltr" },
  zh: { name: "Chinese", nativeName: "中文", dir: "ltr" },
};

/* ─── Catalog types ───────────────────────────────────────────────────── */

/** A flat key→ICU-MessageFormat-string mapping. */
export type TranslationCatalog = Record<string, string>;

/** Namespace identifier for catalog splitting. */
export type CatalogNamespace = string;

/**
 * Async function that resolves a catalog for a given locale.
 * Consumers register one per namespace to enable lazy loading.
 */
export type CatalogLoader = (
  locale: SupportedLocale,
) => TranslationCatalog | Promise<TranslationCatalog>;

/* ─── Formatter value types ───────────────────────────────────────────── */

export type FormatValues = Record<string, string | number | Date | boolean>;

/* ─── Event types ─────────────────────────────────────────────────────── */

export type I18nEvent = "locale-change" | "catalog-load" | "missing-key";

export interface MissingKeyEvent {
  key: string;
  locale: SupportedLocale;
  namespace?: string;
}

export type I18nEventHandler = (data?: unknown) => void;

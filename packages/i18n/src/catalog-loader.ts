/**
 * Utilities for loading JSON translation catalogs at runtime.
 * Consumers use these to register catalog loaders with the I18n instance.
 */

import type { SupportedLocale, TranslationCatalog, CatalogLoader } from "./types.js";

/**
 * Create a catalog loader from a static map of locale → catalog.
 * Useful when catalogs are bundled into the app (no lazy loading).
 *
 * @example
 * import en from "../catalogs/shared/en.json";
 * import es from "../catalogs/shared/es.json";
 * import zh from "../catalogs/shared/zh.json";
 *
 * const loader = staticLoader({ en, es, zh });
 * i18n.registerLoader("shared", loader);
 */
export function staticLoader(
  catalogs: Partial<Record<SupportedLocale, TranslationCatalog>>,
): CatalogLoader {
  return (locale: SupportedLocale) => {
    const catalog = catalogs[locale];
    if (!catalog) {
      throw new Error(`No catalog for locale "${locale}"`);
    }
    return catalog;
  };
}

/**
 * Create a catalog loader that dynamically imports JSON files.
 * Useful for code-splitting — each locale is a separate chunk.
 *
 * @example
 * const loader = dynamicLoader(
 *   (locale) => import(`../catalogs/shared/${locale}.json`)
 * );
 * i18n.registerLoader("shared", loader);
 */
export function dynamicLoader(
  importFn: (locale: SupportedLocale) => Promise<{ default: TranslationCatalog }>,
): CatalogLoader {
  return async (locale: SupportedLocale) => {
    const mod = await importFn(locale);
    return mod.default;
  };
}

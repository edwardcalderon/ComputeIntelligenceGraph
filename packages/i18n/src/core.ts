/**
 * @cig/i18n — Core i18n engine.
 *
 * Framework-agnostic. Works in Node.js, React, React Native, or any JS runtime.
 * Zero external dependencies — uses only native Intl APIs.
 */

import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type SupportedLocale,
  type TranslationCatalog,
  type CatalogLoader,
  type CatalogNamespace,
  type FormatValues,
  type I18nEvent,
  type I18nEventHandler,
  type MissingKeyEvent,
} from "./types.js";
import { formatMessage } from "./format.js";

/* ─── I18n class ──────────────────────────────────────────────────────── */

export class I18n {
  private _locale: SupportedLocale = DEFAULT_LOCALE;
  private _catalogs = new Map<string, TranslationCatalog>();
  private _loaders = new Map<CatalogNamespace, CatalogLoader>();
  private _listeners = new Map<I18nEvent, Set<I18nEventHandler>>();
  private _missingKeys = new Set<string>();

  /* ── Getters ────────────────────────────────────────────────────────── */

  get locale(): SupportedLocale {
    return this._locale;
  }

  /** All missing key events since last reset. */
  get missingKeys(): ReadonlySet<string> {
    return this._missingKeys;
  }

  /* ── Catalog management ─────────────────────────────────────────────── */

  /**
   * Register an async/sync loader for a namespace.
   * Called once per namespace at app startup.
   */
  registerLoader(namespace: CatalogNamespace, loader: CatalogLoader): void {
    this._loaders.set(namespace, loader);
  }

  /**
   * Directly load a catalog for a namespace + locale.
   * Useful when catalogs are bundled statically.
   */
  loadCatalog(
    namespace: CatalogNamespace,
    locale: SupportedLocale,
    catalog: TranslationCatalog,
  ): void {
    const key = `${namespace}:${locale}`;
    this._catalogs.set(key, catalog);
    this._emit("catalog-load", { namespace, locale });
  }

  /* ── Locale activation ──────────────────────────────────────────────── */

  /**
   * Activate a locale, loading specified namespaces via registered loaders.
   * Merges all loaded catalogs for the locale.
   */
  async activate(
    locale: SupportedLocale,
    namespaces: CatalogNamespace[] = [],
  ): Promise<void> {
    // Load any namespaces via registered loaders
    await Promise.all(
      namespaces.map(async (ns) => {
        const loader = this._loaders.get(ns);
        if (!loader) return;
        // Skip if already loaded
        if (this._catalogs.has(`${ns}:${locale}`)) return;
        const catalog = await loader(locale);
        this.loadCatalog(ns, locale, catalog);
      }),
    );

    this._locale = locale;
    this._emit("locale-change", { locale });
  }

  /**
   * Synchronous locale switch (assumes catalogs are already loaded).
   */
  setLocale(locale: SupportedLocale): void {
    this._locale = locale;
    this._emit("locale-change", { locale });
  }

  /* ── Translation ────────────────────────────────────────────────────── */

  /**
   * Translate a key with optional ICU MessageFormat values.
   *
   * @example
   * i18n.t("greeting", { name: "World" })
   * i18n.t("items.count", { count: 5 })
   */
  t(key: string, values?: FormatValues): string {
    const message = this._resolve(key);
    if (message === undefined) {
      this._onMissing(key);
      return key; // Fallback: return the key itself
    }
    return formatMessage(message, values, this._locale);
  }

  /**
   * Check if a translation key exists for the current locale.
   */
  has(key: string): boolean {
    return this._resolve(key) !== undefined;
  }

  /* ── Events ─────────────────────────────────────────────────────────── */

  on(event: I18nEvent, handler: I18nEventHandler): () => void {
    let handlers = this._listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this._listeners.set(event, handlers);
    }
    handlers.add(handler);
    return () => handlers!.delete(handler);
  }

  /* ── Internal ───────────────────────────────────────────────────────── */

  /**
   * Resolve a key by scanning all loaded catalogs for the current locale,
   * falling back to the default locale.
   */
  private _resolve(key: string): string | undefined {
    // Search in current locale across all namespaces
    for (const [catalogKey, catalog] of this._catalogs) {
      if (catalogKey.endsWith(`:${this._locale}`) && key in catalog) {
        return catalog[key];
      }
    }
    // Fallback to default locale
    if (this._locale !== DEFAULT_LOCALE) {
      for (const [catalogKey, catalog] of this._catalogs) {
        if (catalogKey.endsWith(`:${DEFAULT_LOCALE}`) && key in catalog) {
          return catalog[key];
        }
      }
    }
    return undefined;
  }

  private _onMissing(key: string): void {
    const id = `${this._locale}:${key}`;
    if (!this._missingKeys.has(id)) {
      this._missingKeys.add(id);
      const event: MissingKeyEvent = { key, locale: this._locale };
      this._emit("missing-key", event);
    }
  }

  private _emit(event: I18nEvent, data?: unknown): void {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const handler of handlers) handler(data);
    }
  }
}

/* ─── Singleton ───────────────────────────────────────────────────────── */

/** Default global I18n instance. Most apps use this directly. */
export const i18n = new I18n();

/* ─── Helpers ─────────────────────────────────────────────────────────── */

export function isValidLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

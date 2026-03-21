// ── Core (framework-agnostic) ────────────────────────────────────────────
export { I18n, i18n, isValidLocale } from "./core.js";

// ── Types ────────────────────────────────────────────────────────────────
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_META,
  type SupportedLocale,
  type TranslationCatalog,
  type CatalogNamespace,
  type CatalogLoader,
  type FormatValues,
  type I18nEvent,
  type MissingKeyEvent,
} from "./types.js";

// ── Formatter ────────────────────────────────────────────────────────────
export { formatMessage } from "./format.js";

// ── Catalog loaders ──────────────────────────────────────────────────────
export { staticLoader, dynamicLoader } from "./catalog-loader.js";

// ── Detection ────────────────────────────────────────────────────────────
export {
  detectBrowserLocale,
  detectNodeLocale,
  detectMobileLocale,
  persistLocale,
} from "./detection.js";

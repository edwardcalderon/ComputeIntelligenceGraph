/**
 * React bindings for @cig/i18n.
 *
 * Provides I18nProvider, useI18n hook, useLocale hook, and Trans component.
 * Optional — only imported by React consumers. CLI/Node uses core.ts directly.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  createElement,
  type ReactNode,
} from "react";
import { I18n, i18n as defaultInstance } from "./core.js";
import type { SupportedLocale, FormatValues } from "./types.js";

/* ─── Context ─────────────────────────────────────────────────────────── */

interface I18nContextValue {
  i18n: I18n;
  locale: SupportedLocale;
  t: (key: string, values?: FormatValues) => string;
  setLocale: (locale: SupportedLocale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/* ─── Provider ────────────────────────────────────────────────────────── */

interface I18nProviderProps {
  /** I18n instance. Defaults to the global singleton. */
  instance?: I18n;
  children: ReactNode;
}

export function I18nProvider({ instance, children }: I18nProviderProps) {
  const inst = instance ?? defaultInstance;
  const [locale, setLocaleState] = useState<SupportedLocale>(inst.locale);

  useEffect(() => {
    const unsub = inst.on("locale-change", (data) => {
      const d = data as { locale: SupportedLocale };
      setLocaleState(d.locale);
    });
    return unsub;
  }, [inst]);

  const setLocale = useCallback(
    (l: SupportedLocale) => {
      inst.setLocale(l);
    },
    [inst],
  );

  const t = useCallback(
    (key: string, values?: FormatValues) => inst.t(key, values),
    // Re-bind when locale changes so components re-render with new translations
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inst, locale],
  );

  const value: I18nContextValue = { i18n: inst, locale, t, setLocale };

  return createElement(I18nContext.Provider, { value }, children);
}

/* ─── Hooks ───────────────────────────────────────────────────────────── */

/**
 * Access the full i18n context: `{ i18n, locale, t, setLocale }`.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an <I18nProvider>.");
  }
  return ctx;
}

/**
 * Convenience: returns just the current locale.
 */
export function useLocale(): SupportedLocale {
  return useI18n().locale;
}

/**
 * Convenience: returns just the `t` function.
 */
export function useTranslation(): (key: string, values?: FormatValues) => string {
  return useI18n().t;
}

/* ─── Trans component ─────────────────────────────────────────────────── */

interface TransProps {
  /** Translation key. */
  id: string;
  /** ICU MessageFormat values. */
  values?: FormatValues;
  /** Fallback content if key is missing. */
  children?: ReactNode;
}

/**
 * Declarative translation component.
 *
 * @example
 * <Trans id="greeting" values={{ name: "World" }} />
 * <Trans id="welcome">Welcome back</Trans>
 */
export function Trans({ id, values, children }: TransProps) {
  const { t, i18n } = useI18n();
  const translated = i18n.has(id) ? t(id, values) : undefined;
  return createElement("span", null, translated ?? children ?? id);
}

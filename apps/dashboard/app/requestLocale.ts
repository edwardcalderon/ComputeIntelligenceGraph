import { DEFAULT_LOCALE, isValidLocale, type SupportedLocale } from "@cig-technology/i18n";
import { cookies, headers } from "next/headers";

function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (isValidLocale(normalized)) {
    return normalized;
  }

  const base = normalized.split(/[-_]/, 1)[0];
  return base && isValidLocale(base) ? base : null;
}

export function resolveRequestLocale(): SupportedLocale {
  const cookieLocale = normalizeLocale(cookies().get("cig-locale")?.value);
  if (cookieLocale) {
    return cookieLocale;
  }

  const acceptLanguage = headers().get("accept-language") ?? "";
  for (const candidate of acceptLanguage.split(",")) {
    const locale = normalizeLocale(candidate.split(";")[0]);
    if (locale) {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}

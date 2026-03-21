/**
 * Lightweight ICU MessageFormat formatter.
 *
 * Supports:
 *  - Simple interpolation:  "Hello {name}"
 *  - Plural:   "{count, plural, one {# item} other {# items}}"
 *  - Select:   "{gender, select, male {He} female {She} other {They}}"
 *  - Number:   "{price, number}"
 *  - Escaped:  "'{literal braces}'"
 *
 * Uses native Intl.PluralRules and Intl.NumberFormat — zero external deps.
 */

import type { FormatValues } from "./types.js";

// ── Plural rules cache ──────────────────────────────────────────────────
const pluralRulesCache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

// ── Number format cache ─────────────────────────────────────────────────
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getNumberFormat(locale: string): Intl.NumberFormat {
  let fmt = numberFormatCache.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale);
    numberFormatCache.set(locale, fmt);
  }
  return fmt;
}

// ── Brace-aware block parser ────────────────────────────────────────────

/**
 * Given a string starting after the opening `{` of an ICU block,
 * find the matching closing `}` respecting nested braces.
 * Returns the index of the closing brace relative to `str`.
 */
function findMatchingBrace(str: string): number {
  let depth = 1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return str.length; // unmatched — return end
}

/**
 * Parse plural/select options from a string like:
 *   "one {# item} other {# items}"
 * Returns a Map of keyword → message.
 */
function parseOptions(str: string): Map<string, string> {
  const options = new Map<string, string>();
  const s = str.trim();
  let i = 0;

  while (i < s.length) {
    // Skip whitespace
    while (i < s.length && /\s/.test(s[i]!)) i++;
    if (i >= s.length) break;

    // Read keyword (e.g. "one", "other", "male", "=0")
    let keyword = "";
    while (i < s.length && s[i] !== "{" && !/\s/.test(s[i]!)) {
      keyword += s[i];
      i++;
    }

    // Skip whitespace before opening brace
    while (i < s.length && /\s/.test(s[i]!)) i++;

    if (s[i] !== "{") break;
    i++; // skip opening brace

    const end = findMatchingBrace(s.slice(i));
    const body = s.slice(i, i + end);
    options.set(keyword, body);
    i += end + 1; // skip closing brace
  }

  return options;
}

// ── Main format function ────────────────────────────────────────────────

export function formatMessage(
  message: string,
  values: FormatValues | undefined,
  locale: string,
): string {
  // Fast path: no placeholders and no escape sequences
  if (!message.includes("{") && !message.includes("'")) {
    return message;
  }
  return resolveMessage(message, values ?? {}, locale);
}

function resolveMessage(
  message: string,
  values: FormatValues,
  locale: string,
): string {
  let result = "";
  let i = 0;

  while (i < message.length) {
    // Escaped single quote: '' → '
    if (message[i] === "'" && message[i + 1] === "'") {
      result += "'";
      i += 2;
      continue;
    }

    // Escaped block: '{literal}'
    if (message[i] === "'") {
      const end = message.indexOf("'", i + 1);
      if (end !== -1) {
        result += message.slice(i + 1, end);
        i = end + 1;
        continue;
      }
    }

    // ICU placeholder: {…}
    if (message[i] === "{") {
      const blockEnd = findMatchingBrace(message.slice(i + 1));
      const block = message.slice(i + 1, i + 1 + blockEnd);
      result += resolveBlock(block, values, locale);
      i += blockEnd + 2; // skip { + content + }
      continue;
    }

    result += message[i];
    i++;
  }

  return result;
}

function resolveBlock(
  block: string,
  values: FormatValues,
  locale: string,
): string {
  const parts = block.split(",").map((s) => s.trim());
  const varName = parts[0]!;
  const value = values[varName];

  // Simple interpolation: {name}
  if (parts.length === 1) {
    return value != null ? String(value) : `{${varName}}`;
  }

  const type = parts[1]!;

  // Number formatting: {price, number}
  if (type === "number") {
    const num = typeof value === "number" ? value : Number(value);
    return isNaN(num) ? String(value ?? "") : getNumberFormat(locale).format(num);
  }

  // Plural: {count, plural, one {# item} other {# items}}
  if (type === "plural") {
    const optionsStr = parts.slice(2).join(",");
    const options = parseOptions(optionsStr);
    const num = typeof value === "number" ? value : Number(value);
    const numStr = isNaN(num) ? String(value ?? "0") : getNumberFormat(locale).format(num);

    // Try exact match (=0, =1, etc.)
    const exactMatch = options.get(`=${num}`);
    if (exactMatch != null) {
      return resolveMessage(exactMatch.replace(/#/g, numStr), values, locale);
    }

    // Try plural category
    const category = isNaN(num) ? "other" : getPluralRules(locale).select(num);
    const catMatch = options.get(category) ?? options.get("other") ?? "";
    return resolveMessage(catMatch.replace(/#/g, numStr), values, locale);
  }

  // Select: {gender, select, male {He} female {She} other {They}}
  if (type === "select") {
    const optionsStr = parts.slice(2).join(",");
    const options = parseOptions(optionsStr);
    const key = String(value ?? "other");
    const match = options.get(key) ?? options.get("other") ?? "";
    return resolveMessage(match, values, locale);
  }

  // Unknown type — return raw
  return value != null ? String(value) : `{${block}}`;
}

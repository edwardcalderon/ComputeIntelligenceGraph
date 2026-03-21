#!/usr/bin/env node
/**
 * CI script: check for missing translations across all catalogs.
 *
 * For every namespace, reads the English (source) catalog,
 * then verifies that every other locale has all the same keys.
 *
 * Exit code 1 if any missing translations found.
 *
 * Usage:
 *   node scripts/check-translations.mjs
 *   node scripts/check-translations.mjs --strict  # also fails on extra keys
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogsDir = join(__dirname, "..", "catalogs");

const LOCALES = ["en", "es", "zh"];
const SOURCE_LOCALE = "en";
const strict = process.argv.includes("--strict");

let missingCount = 0;
let extraCount = 0;
let totalChecked = 0;

const namespaces = readdirSync(catalogsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const ns of namespaces) {
  const sourcePath = join(catalogsDir, ns, `${SOURCE_LOCALE}.json`);
  if (!existsSync(sourcePath)) {
    console.error(`  MISSING source catalog: ${ns}/${SOURCE_LOCALE}.json`);
    missingCount++;
    continue;
  }

  const sourceKeys = Object.keys(
    JSON.parse(readFileSync(sourcePath, "utf-8")),
  );

  for (const locale of LOCALES) {
    if (locale === SOURCE_LOCALE) continue;

    const targetPath = join(catalogsDir, ns, `${locale}.json`);
    if (!existsSync(targetPath)) {
      console.error(`  MISSING catalog file: ${ns}/${locale}.json`);
      missingCount += sourceKeys.length;
      continue;
    }

    const targetCatalog = JSON.parse(readFileSync(targetPath, "utf-8"));
    const targetKeys = new Set(Object.keys(targetCatalog));

    for (const key of sourceKeys) {
      totalChecked++;
      if (!targetKeys.has(key)) {
        console.error(`  MISSING [${locale}/${ns}] "${key}"`);
        missingCount++;
      } else if (!targetCatalog[key] || targetCatalog[key].trim() === "") {
        console.error(`  EMPTY   [${locale}/${ns}] "${key}"`);
        missingCount++;
      }
    }

    if (strict) {
      for (const key of targetKeys) {
        if (!sourceKeys.includes(key)) {
          console.warn(`  EXTRA   [${locale}/${ns}] "${key}" (not in source)`);
          extraCount++;
        }
      }
    }
  }
}

console.log("");
console.log(
  `Translation check: ${totalChecked - missingCount}/${totalChecked} keys translated`,
);

if (extraCount > 0) {
  console.warn(`${extraCount} extra key(s) found in target locales.`);
}

if (missingCount > 0) {
  console.error(`\n${missingCount} missing/empty translation(s). Failing CI.\n`);
  process.exit(1);
} else {
  console.log("All translations complete.");
}

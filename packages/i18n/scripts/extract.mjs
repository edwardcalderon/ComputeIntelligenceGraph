#!/usr/bin/env node
/**
 * Extract translation keys from source code.
 *
 * Scans for patterns:
 *   i18n.t("key")  /  t("key")  /  <Trans id="key">
 *
 * Compares found keys against existing catalogs and reports
 * any keys used in code that are missing from catalogs.
 *
 * Usage:
 *   node scripts/extract.mjs [--scan-dir ../../apps/landing]
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogsDir = join(__dirname, "..", "catalogs");

// Parse args
const args = process.argv.slice(2);
const scanDirIdx = args.indexOf("--scan-dir");
const scanDirs =
  scanDirIdx >= 0
    ? [args[scanDirIdx + 1]]
    : [
        join(__dirname, "..", "..", "..", "apps", "landing"),
        join(__dirname, "..", "..", "..", "apps", "dashboard"),
        join(__dirname, "..", "..", "..", "packages", "cli"),
      ];

// Patterns that capture translation keys
const patterns = [
  /(?:i18n\.t|(?<!\w)t)\(\s*["'`]([^"'`]+)["'`]/g, // t("key") or i18n.t("key")
  /<Trans\s+id=["']([^"']+)["']/g, // <Trans id="key">
  /useTranslation\(\).*?\.t\(\s*["'`]([^"'`]+)["'`]/g, // destructured t from hook
];

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

function* walkFiles(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".next" ||
        entry.name === ".turbo"
      )
        continue;
      yield* walkFiles(full);
    } else if (sourceExtensions.has(extname(entry.name))) {
      yield full;
    }
  }
}

// Collect all keys used in code
const usedKeys = new Set();
for (const scanDir of scanDirs) {
  if (!scanDir || !existsSync(scanDir)) continue;
  for (const file of walkFiles(scanDir)) {
    const content = readFileSync(file, "utf-8");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        usedKeys.add(match[1]);
      }
    }
  }
}

// Collect all keys in catalogs
const catalogKeys = new Set();
const namespaces = readdirSync(catalogsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const ns of namespaces) {
  const enPath = join(catalogsDir, ns, "en.json");
  if (!existsSync(enPath)) continue;
  const catalog = JSON.parse(readFileSync(enPath, "utf-8"));
  for (const key of Object.keys(catalog)) {
    catalogKeys.add(key);
  }
}

// Report
const missingFromCatalog = [...usedKeys].filter((k) => !catalogKeys.has(k));
const unusedInCatalog = [...catalogKeys].filter((k) => !usedKeys.has(k));

console.log(`Keys used in code: ${usedKeys.size}`);
console.log(`Keys in catalogs:  ${catalogKeys.size}`);
console.log("");

if (missingFromCatalog.length > 0) {
  console.error(
    `${missingFromCatalog.length} key(s) used in code but MISSING from catalogs:`,
  );
  for (const key of missingFromCatalog.sort()) {
    console.error(`  - "${key}"`);
  }
  console.log("");
}

if (unusedInCatalog.length > 0) {
  console.warn(
    `${unusedInCatalog.length} key(s) in catalogs but NOT found in scanned code:`,
  );
  for (const key of unusedInCatalog.sort()) {
    console.warn(`  ~ "${key}"`);
  }
  console.log("");
}

if (missingFromCatalog.length > 0) {
  process.exit(1);
} else {
  console.log("All code translation keys exist in catalogs.");
}

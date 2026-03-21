#!/usr/bin/env bash
# ─── @cig-technology/i18n standalone release script ───────────────────────
#
# Usage:
#   ./scripts/release.sh patch    # 1.0.0 → 1.0.1
#   ./scripts/release.sh minor    # 1.0.0 → 1.1.0
#   ./scripts/release.sh major    # 1.0.0 → 2.0.0
#   ./scripts/release.sh 1.2.3    # exact version
#   ./scripts/release.sh --dry-run patch
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PKG_DIR"

DRY_RUN=false
VERSION_ARG=""

# Parse args
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) VERSION_ARG="$arg" ;;
  esac
done

if [ -z "$VERSION_ARG" ]; then
  echo "Usage: $0 [--dry-run] <patch|minor|major|x.y.z>"
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 @cig-technology/i18n"
echo "   Current version: $CURRENT_VERSION"

# ── 1. Bump version ──────────────────────────────────────────────────────
if [[ "$VERSION_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$VERSION_ARG"
else
  NEW_VERSION=$(npm version "$VERSION_ARG" --no-git-tag-version --json 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'))" 2>/dev/null || true)
  if [ -z "$NEW_VERSION" ]; then
    npm version "$VERSION_ARG" --no-git-tag-version > /dev/null
    NEW_VERSION=$(node -p "require('./package.json').version")
  fi
fi

echo "   New version:     $NEW_VERSION"

# ── 2. Update README version badge ───────────────────────────────────────
sed -i "s/<!-- version: .* -->/<!-- version: $NEW_VERSION -->/" README.md 2>/dev/null || true

# ── 3. Validate ──────────────────────────────────────────────────────────
echo ""
echo "🔍 Running checks..."

echo "   → Type-check"
npx tsc --noEmit

echo "   → Tests"
npx vitest run --silent

echo "   → Translation check"
node scripts/check-translations.mjs

echo "   → Build"
node scripts/compile-catalogs.mjs && npx tsc

echo ""
echo "✅ All checks passed."

# ── 4. Tag & push ────────────────────────────────────────────────────────
TAG="i18n-v${NEW_VERSION}"

if $DRY_RUN; then
  echo ""
  echo "🏷️  Would create tag: $TAG"
  echo "📦 Would publish: @cig-technology/i18n@$NEW_VERSION"
  echo ""
  echo "Dry run complete. No changes made."
  # Revert version bump
  npm version "$CURRENT_VERSION" --no-git-tag-version > /dev/null
  sed -i "s/<!-- version: .* -->/<!-- version: $CURRENT_VERSION -->/" README.md 2>/dev/null || true
  exit 0
fi

echo ""
echo "🏷️  Creating tag: $TAG"

# Stage changes
git add package.json README.md
git commit -m "chore(i18n): release v${NEW_VERSION}" --no-verify
git tag -a "$TAG" -m "@cig-technology/i18n v${NEW_VERSION}"

echo ""
echo "🚀 Push tag to trigger npm publish:"
echo "   git push origin main --tags"
echo ""
echo "Or publish manually:"
echo "   cd packages/i18n && npm publish --access public"

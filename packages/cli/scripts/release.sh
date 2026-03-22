#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PKG_DIR"

DRY_RUN=false
VERSION_ARG=""
PRERELEASE_ID="beta"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    alpha|beta|rc)
      PRERELEASE_ID="$arg"
      ;;
    *)
      VERSION_ARG="$arg"
      ;;
  esac
done

if [ -z "$VERSION_ARG" ]; then
  echo "Usage: $0 [--dry-run] <patch|minor|major|prerelease|x.y.z> [alpha|beta|rc]"
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 @cig-technology/cli"
echo "   Current version: $CURRENT_VERSION"

if [[ "$VERSION_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][a-zA-Z0-9.]+)?$ ]]; then
  NEW_VERSION="$VERSION_ARG"
  versioning release "$NEW_VERSION" -c versioning.config.json --no-commit --no-tag --skip-sync > /dev/null
elif [ "$VERSION_ARG" = "prerelease" ]; then
  versioning bump prerelease --pre-release "$PRERELEASE_ID" -c versioning.config.json --no-commit --no-tag > /dev/null
  NEW_VERSION=$(node -p "require('./package.json').version")
else
  versioning "$VERSION_ARG" -c versioning.config.json --no-commit --no-tag > /dev/null
  NEW_VERSION=$(node -p "require('./package.json').version")
fi

echo "   New version:     $NEW_VERSION"

if ! grep -Eq "^##?\\s+\\[?v?${NEW_VERSION//./\\.}(?:-[a-zA-Z0-9.]+)?\\]?" CHANGELOG.md; then
  echo "❌ CHANGELOG.md does not contain an entry for ${NEW_VERSION}."
  echo "   Add the changelog entry first, then rerun the release script."
  exit 1
fi

echo ""
echo "🔍 Running checks..."
npm run version:update-readme
npm run version:validate
npm run build
npx vitest run --silent
npm pack --dry-run > /dev/null
echo "✅ All checks passed."

TAG="cli-v${NEW_VERSION}"

if $DRY_RUN; then
  echo ""
  echo "🏷️  Would create tag: $TAG"
  echo "📦 Would publish: @cig-technology/cli@$NEW_VERSION"
  versioning release "$CURRENT_VERSION" -c versioning.config.json --no-commit --no-tag --skip-sync > /dev/null
  npm run version:update-readme > /dev/null 2>&1 || true
  exit 0
fi

echo ""
echo "🏷️  Creating tag: $TAG"
git add package.json package-lock.json versioning.config.json CHANGELOG.md README.md scripts/release.sh scripts/sync-readme.mjs scripts/guard-readme.mjs
git commit -m "chore(cli): release v${NEW_VERSION}" --no-verify
git tag -a "$TAG" -m "@cig-technology/cli v${NEW_VERSION}"

echo ""
echo "🚀 Push tag to trigger npm publish:"
echo "   git push origin main --tags"

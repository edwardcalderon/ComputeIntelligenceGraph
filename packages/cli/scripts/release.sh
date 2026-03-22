#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PKG_DIR"

DRY_RUN=false
VERSION_ARG=""

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
echo "📦 @cig-technology/cli"
echo "   Current version: $CURRENT_VERSION"

if [[ "$VERSION_ARG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$VERSION_ARG"
  npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version > /dev/null
else
  npm version "$VERSION_ARG" --no-git-tag-version > /dev/null
  NEW_VERSION=$(node -p "require('./package.json').version")
fi

echo "   New version:     $NEW_VERSION"

echo ""
echo "🔍 Running checks..."
npx tsc --noEmit
npx vitest run --silent
npm run build
npm pack --dry-run > /dev/null
echo "✅ All checks passed."

TAG="cli-v${NEW_VERSION}"

if $DRY_RUN; then
  echo ""
  echo "🏷️  Would create tag: $TAG"
  echo "📦 Would publish: @cig-technology/cli@$NEW_VERSION"
  npm version "$CURRENT_VERSION" --no-git-tag-version --allow-same-version > /dev/null
  exit 0
fi

echo ""
echo "🏷️  Creating tag: $TAG"
git add package.json package-lock.json README.md
git commit -m "chore(cli): release v${NEW_VERSION}" --no-verify
git tag -a "$TAG" -m "@cig-technology/cli v${NEW_VERSION}"

echo ""
echo "🚀 Push tag to trigger npm publish:"
echo "   git push origin main --tags"

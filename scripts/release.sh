#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CIG Release Script
# Uses @edcalderon/versioning to handle:
#   - Semantic version bumps (patch / minor / major)
#   - Auto-generated CHANGELOG.md from conventional commits
#   - README badge/version auto-update
#   - Git commit, tag, and push
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Helpers ─────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}ℹ ${NC} $*"; }
success() { echo -e "${GREEN}✔ ${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠ ${NC} $*"; }
error()   { echo -e "${RED}✖ ${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}── $* ──${NC}"; }

# ── Pre-flight checks ──────────────────────────────────────────────────────
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v git       >/dev/null 2>&1 || { error "git is not installed"; exit 1; }
command -v pnpm      >/dev/null 2>&1 || { error "pnpm is not installed"; exit 1; }
command -v npx       >/dev/null 2>&1 || { error "npx is not installed"; exit 1; }

# ── Parse arguments ────────────────────────────────────────────────────────
BUMP_TYPE=""
DRY_RUN=false
SKIP_PUSH=false
SKIP_TESTS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    patch|minor|major) BUMP_TYPE="$1"; shift ;;
    --dry-run)    DRY_RUN=true;    shift ;;
    --no-push)    SKIP_PUSH=true;  shift ;;
    --no-tests)   SKIP_TESTS=true; shift ;;
    -h|--help)    BUMP_TYPE="help"; shift ;;
    *)            error "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Usage ───────────────────────────────────────────────────────────────────
if [[ -z "$BUMP_TYPE" || "$BUMP_TYPE" == "help" ]]; then
  echo ""
  echo -e "${BOLD}CIG Release Script${NC}"
  echo ""
  echo -e "${BOLD}Usage:${NC}"
  echo "  ./scripts/release.sh <patch|minor|major> [options]"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  --dry-run     Show what would happen without making changes"
  echo "  --no-push     Commit and tag but don't push to remote"
  echo "  --no-tests    Skip test step (use with caution)"
  echo "  -h, --help    Show this help message"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  ./scripts/release.sh patch              # 0.1.0 → 0.1.1"
  echo "  ./scripts/release.sh minor              # 0.1.0 → 0.2.0"
  echo "  ./scripts/release.sh major              # 0.1.0 → 1.0.0"
  echo "  ./scripts/release.sh patch --dry-run    # Preview without changes"
  echo "  ./scripts/release.sh minor --no-push    # Release locally only"
  echo ""
  echo -e "${BOLD}What it does:${NC}"
  echo "  1. Validates clean working tree (or stages all changes)"
  echo "  2. Runs tests (unless --no-tests)"
  echo "  3. Bumps version across all packages via @edcalderon/versioning"
  echo "  4. Generates / updates CHANGELOG.md"
  echo "  5. Updates README.md version badge"
  echo "  6. Commits everything with a conventional release message"
  echo "  7. Creates a git tag (v{version})"
  echo "  8. Pushes to remote (unless --no-push)"
  echo ""
  exit 0
fi

# ── Validate bump type ─────────────────────────────────────────────────────
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  error "Invalid bump type: '$BUMP_TYPE'. Use patch, minor, or major."
  exit 1
fi

# ── Read current version ───────────────────────────────────────────────────
CURRENT_VERSION=$(node -p "require('./package.json').version")
info "Current version: ${BOLD}v${CURRENT_VERSION}${NC}"
info "Bump type:       ${BOLD}${BUMP_TYPE}${NC}"

if $DRY_RUN; then
  warn "DRY RUN mode — no changes will be written"
fi

# ── Calculate next version ─────────────────────────────────────────────────
IFS='.' read -r V_MAJOR V_MINOR V_PATCH <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  patch) V_PATCH=$((V_PATCH + 1)) ;;
  minor) V_MINOR=$((V_MINOR + 1)); V_PATCH=0 ;;
  major) V_MAJOR=$((V_MAJOR + 1)); V_MINOR=0; V_PATCH=0 ;;
esac
NEXT_VERSION="${V_MAJOR}.${V_MINOR}.${V_PATCH}"
info "Next version:    ${BOLD}v${NEXT_VERSION}${NC}"

echo ""
read -rp "$(echo -e "${YELLOW}Proceed with release v${NEXT_VERSION}? [y/N]${NC} ")" CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  info "Release cancelled."
  exit 0
fi

# ── Step 1: Check working tree ─────────────────────────────────────────────
step "1/7 Checking working tree"
DIRTY_FILES=$(git status --porcelain 2>/dev/null | grep -cv '^$' || true)
if [[ "$DIRTY_FILES" -gt 0 ]]; then
  warn "Working tree has ${DIRTY_FILES} uncommitted change(s)"
  info "Staging all changes as part of this release..."
  if ! $DRY_RUN; then
    git add -A
  fi
  success "Changes staged"
else
  success "Working tree is clean"
fi

# ── Step 2: Run tests ──────────────────────────────────────────────────────
step "2/7 Running tests"
if $SKIP_TESTS; then
  warn "Tests skipped (--no-tests)"
else
  if ! $DRY_RUN; then
    pnpm test 2>&1 || { error "Tests failed. Fix them before releasing."; exit 1; }
    success "All tests passed"
  else
    info "[dry-run] Would run: pnpm test"
  fi
fi

# ── Step 3: Bump version across all packages ───────────────────────────────
step "3/7 Bumping version (${BUMP_TYPE})"
if ! $DRY_RUN; then
  npx versioning "$BUMP_TYPE" --no-commit --no-tag \
    --message "release: v${NEXT_VERSION}" 2>&1
  success "Version bumped to ${NEXT_VERSION} across all packages"
else
  info "[dry-run] Would run: npx versioning ${BUMP_TYPE} --no-commit --no-tag"
fi

# ── Step 4: Generate changelog ──────────────────────────────────────────────
step "4/7 Generating changelog"
if ! $DRY_RUN; then
  npx versioning changelog 2>&1
  success "CHANGELOG.md updated"
else
  info "[dry-run] Would run: npx versioning changelog"
fi

# ── Step 5: Update README ──────────────────────────────────────────────────
step "5/7 Updating README"
if ! $DRY_RUN; then
  # Update the version badge in README.md
  sed -i "s/version-[0-9]*\.[0-9]*\.[0-9]*/version-${NEXT_VERSION}/g" README.md
  # Update the "Version" line in Project Status section
  sed -i "s/\*\*Version\*\*: [0-9]*\.[0-9]*\.[0-9]*/\*\*Version\*\*: ${NEXT_VERSION}/g" README.md
  # Update the "All packages maintain version" line
  sed -i "s/maintain version \*\*[0-9]*\.[0-9]*\.[0-9]*\*\*/maintain version \*\*${NEXT_VERSION}\*\*/g" README.md
  # Try the versioning update-readme command (may no-op if no CHANGELOG yet)
  npx versioning update-readme 2>&1 || true
  success "README.md updated with v${NEXT_VERSION}"
else
  info "[dry-run] Would update README.md version references to ${NEXT_VERSION}"
fi

# ── Step 6: Commit & tag ──────────────────────────────────────────────────
step "6/7 Committing & tagging"
COMMIT_MSG="release: v${NEXT_VERSION}

- Bump version: ${CURRENT_VERSION} → ${NEXT_VERSION} (${BUMP_TYPE})
- Update CHANGELOG.md
- Update README.md version references
- Sync all package versions via @edcalderon/versioning"

if ! $DRY_RUN; then
  git add -A
  git commit -m "$COMMIT_MSG"
  git tag -a "v${NEXT_VERSION}" -m "Release v${NEXT_VERSION}"
  success "Committed and tagged v${NEXT_VERSION}"
else
  info "[dry-run] Would commit with message:"
  echo "  $COMMIT_MSG"
  info "[dry-run] Would create tag: v${NEXT_VERSION}"
fi

# ── Step 7: Push ────────────────────────────────────────────────────────────
step "7/7 Pushing to remote"
if $SKIP_PUSH; then
  warn "Push skipped (--no-push). Run manually:"
  echo "  git push && git push --tags"
elif ! $DRY_RUN; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  git push origin "$BRANCH"
  git push origin "v${NEXT_VERSION}"
  success "Pushed ${BRANCH} + tag v${NEXT_VERSION}"
else
  info "[dry-run] Would push branch + tag to origin"
fi

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}🎉 Release v${NEXT_VERSION} complete!${NC}"
echo ""
echo -e "  Version:   ${BOLD}${CURRENT_VERSION} → ${NEXT_VERSION}${NC}"
echo -e "  Tag:       ${BOLD}v${NEXT_VERSION}${NC}"
echo -e "  Changelog: ${BOLD}CHANGELOG.md${NC}"
echo ""

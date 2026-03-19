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
command -v node      >/dev/null 2>&1 || { error "node is not installed"; exit 1; }
command -v pnpm      >/dev/null 2>&1 || { error "pnpm is not installed"; exit 1; }

# ── Parse arguments ────────────────────────────────────────────────────────
BUMP_TYPE=""
DRY_RUN=false
SKIP_PUSH=false
SKIP_TESTS=false
AUTO_CONFIRM=false

RELEASE_EXCLUDE_PATTERNS=(
  ".vscode/**"
  "**/node_modules/**"
  "**/.next/**"
  "**/dist/**"
  "**/.turbo/**"
  "**/coverage/**"
  "**/*.tsbuildinfo"
)

is_release_excluded_path() {
  local path="$1"

  case "$path" in
    .vscode/*|*/node_modules/*|*/.next/*|*/dist/*|*/.turbo/*|*/coverage/*|*.tsbuildinfo)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

stage_release_changes() {
  local pattern=""

  git add -A
  for pattern in "${RELEASE_EXCLUDE_PATTERNS[@]}"; do
    git restore --staged -- ":(glob)${pattern}" 2>/dev/null || true
  done
}

summarize_worktree() {
  local included=0
  local excluded=0
  local line=""
  local path=""

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    path="${line:3}"

    if [[ "$path" == *" -> "* ]]; then
      path="${path##* -> }"
    fi

    if is_release_excluded_path "$path"; then
      ((excluded+=1))
    else
      ((included+=1))
    fi
  done < <(git status --porcelain=1)

  echo "${included} ${excluded}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    patch|minor|major) BUMP_TYPE="$1"; shift ;;
    --dry-run)    DRY_RUN=true;    shift ;;
    --no-push)    SKIP_PUSH=true;  shift ;;
    --no-tests)   SKIP_TESTS=true; shift ;;
    --yes|-y)     AUTO_CONFIRM=true; shift ;;
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
  echo "  --yes, -y     Skip confirmation prompt"
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
  echo "  1. Validates branch state and stages source changes for release"
  echo "  2. Syncs workspace dependencies with pnpm install --frozen-lockfile"
  echo "  3. Runs tests (unless --no-tests)"
  echo "  4. Bumps version across all packages via @edcalderon/versioning"
  echo "  5. Generates / updates CHANGELOG.md"
  echo "  6. Updates README.md version badge"
  echo "  7. Commits and tags the release"
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

if git rev-parse --verify --quiet "refs/tags/v${NEXT_VERSION}" >/dev/null; then
  error "Tag v${NEXT_VERSION} already exists. Choose a higher version bump."
  exit 1
fi

if ! $DRY_RUN && ! $AUTO_CONFIRM; then
  echo ""
  read -rp "$(echo -e "${YELLOW}Proceed with release v${NEXT_VERSION}? [y/N]${NC} ")" CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    info "Release cancelled."
    exit 0
  fi
else
  info "Skipping confirmation prompt"
fi

# ── Step 1: Check branch state ─────────────────────────────────────────────
step "1/8 Checking branch state"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "HEAD" ]]; then
  error "Detached HEAD is not supported for releases."
  exit 1
fi

UPSTREAM_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || true)
if [[ -n "$UPSTREAM_BRANCH" ]]; then
  read -r AHEAD_COUNT BEHIND_COUNT <<< "$(git rev-list --left-right --count HEAD...@{u})"
  if [[ "$BEHIND_COUNT" -gt 0 ]]; then
    error "Branch ${BRANCH} is behind ${UPSTREAM_BRANCH} by ${BEHIND_COUNT} commit(s). Pull latest changes before releasing."
    exit 1
  fi
  info "Branch ${BRANCH} is up to date with ${UPSTREAM_BRANCH} (ahead ${AHEAD_COUNT}, behind ${BEHIND_COUNT})"
else
  warn "No upstream tracking branch configured for ${BRANCH}"
fi

# ── Step 2: Check working tree ─────────────────────────────────────────────
step "2/8 Checking working tree"
read -r INCLUDED_DIRTY EXCLUDED_DIRTY <<< "$(summarize_worktree)"
TOTAL_DIRTY=$((INCLUDED_DIRTY + EXCLUDED_DIRTY))

if [[ "$TOTAL_DIRTY" -gt 0 ]]; then
  warn "Working tree has ${TOTAL_DIRTY} uncommitted change(s)"
  if [[ "$EXCLUDED_DIRTY" -gt 0 ]]; then
    warn "Ignoring ${EXCLUDED_DIRTY} generated/local change(s) during release staging"
  fi
  if [[ "$INCLUDED_DIRTY" -gt 0 ]]; then
    info "Staging ${INCLUDED_DIRTY} source change(s) as part of this release..."
    if ! $DRY_RUN; then
      stage_release_changes
    fi
    success "Release changes staged"
  else
    success "Only generated/local files are dirty; they will not be committed"
  fi
else
  success "Working tree is clean"
fi

# ── Step 3: Sync workspace dependencies ────────────────────────────────────
step "3/8 Syncing workspace dependencies"
if ! $DRY_RUN; then
  pnpm install --frozen-lockfile 2>&1
  success "Workspace dependencies are in sync"
else
  info "[dry-run] Would run: pnpm install --frozen-lockfile"
fi

# ── Step 4: Run tests ──────────────────────────────────────────────────────
step "4/8 Running tests"
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

# ── Step 5: Bump version across all packages ───────────────────────────────
step "5/8 Bumping version (${BUMP_TYPE})"
if ! $DRY_RUN; then
  pnpm exec versioning "$BUMP_TYPE" --no-commit --no-tag \
    --message "chore(release): v${NEXT_VERSION}" 2>&1
  success "Version bumped to ${NEXT_VERSION} across all packages"
else
  info "[dry-run] Would run: pnpm exec versioning ${BUMP_TYPE} --no-commit --no-tag"
fi

# ── Step 6: Generate changelog ──────────────────────────────────────────────
step "6/8 Generating changelog"
if ! $DRY_RUN; then
  pnpm exec versioning changelog 2>&1
  success "CHANGELOG.md updated"
else
  info "[dry-run] Would run: pnpm exec versioning changelog"
fi

# ── Step 7: Update README ──────────────────────────────────────────────────
step "7/8 Updating README"
if ! $DRY_RUN; then
  # Update the version badge in README.md
  sed -i "s/version-[0-9]*\.[0-9]*\.[0-9]*/version-${NEXT_VERSION}/g" README.md
  # Update the "Version" line in Project Status section
  sed -i "s/\*\*Version\*\*: [0-9]*\.[0-9]*\.[0-9]*/\*\*Version\*\*: ${NEXT_VERSION}/g" README.md
  # Update the "All packages maintain version" line
  sed -i "s/maintain version \*\*[0-9]*\.[0-9]*\.[0-9]*\*\*/maintain version \*\*${NEXT_VERSION}\*\*/g" README.md
  # Try the versioning update-readme command (may no-op if no CHANGELOG yet)
  pnpm exec versioning update-readme 2>&1 || true
  success "README.md updated with v${NEXT_VERSION}"
else
  info "[dry-run] Would update README.md version references to ${NEXT_VERSION}"
fi

# ── Step 8: Commit & tag ──────────────────────────────────────────────────
step "8/8 Committing, tagging, and pushing"
COMMIT_MSG="chore(release): v${NEXT_VERSION}

- Bump version: ${CURRENT_VERSION} → ${NEXT_VERSION} (${BUMP_TYPE})
- Update CHANGELOG.md
- Update README.md version references
- Sync all package versions via @edcalderon/versioning"

if ! $DRY_RUN; then
  stage_release_changes
  git commit -m "$COMMIT_MSG"
  git tag -a "v${NEXT_VERSION}" -m "Release v${NEXT_VERSION}"
  success "Committed and tagged v${NEXT_VERSION}"
else
  info "[dry-run] Would commit with message:"
  echo "  $COMMIT_MSG"
  info "[dry-run] Would create tag: v${NEXT_VERSION}"
fi

if $SKIP_PUSH; then
  warn "Push skipped (--no-push). Run manually:"
  echo "  git push && git push --tags"
elif ! $DRY_RUN; then
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

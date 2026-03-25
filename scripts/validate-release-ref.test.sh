#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
validator="${repo_root}/scripts/validate-release-ref.sh"

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

assert_passes() {
  if ! "$@"; then
    echo "Expected command to pass: $*" >&2
    exit 1
  fi
}

assert_fails() {
  if "$@" >/dev/null 2>&1; then
    echo "Expected command to fail: $*" >&2
    exit 1
  fi
}

assert_passes_in_repo() {
  local repo="$1"
  shift
  (
    cd "$repo"
    assert_passes "$@"
  )
}

assert_fails_in_repo() {
  local repo="$1"
  shift
  (
    cd "$repo"
    assert_fails "$@"
  )
}

make_repo() {
  local version="$1"
  local dir="$2"

  git init -q "$dir"
  git -C "$dir" config user.email "codex@example.com"
  git -C "$dir" config user.name "Codex"

  cat >"$dir/package.json" <<EOF
{
  "name": "cig-release-test",
  "version": "${version}"
}
EOF

  git -C "$dir" add package.json
  git -C "$dir" commit -q -m "test: add package version"
}

make_cli_repo() {
  local version="$1"
  local dir="$2"

  git init -q "$dir"
  git -C "$dir" config user.email "codex@example.com"
  git -C "$dir" config user.name "Codex"

  mkdir -p "$dir/packages/cli"
  cat >"$dir/packages/cli/package.json" <<EOF
{
  "name": "@cig-technology/cli",
  "version": "${version}"
}
EOF

  git -C "$dir" add packages/cli/package.json
  git -C "$dir" commit -q -m "test: add cli package version"
}

bad_repo="${tmpdir}/bad"
stale_repo="${tmpdir}/stale"
floor_repo="${tmpdir}/floor"
good_repo="${tmpdir}/good"
cli_good_repo="${tmpdir}/cli-good"
cli_followup_repo="${tmpdir}/cli-followup"
cli_floor_repo="${tmpdir}/cli-floor"
mkdir -p "$bad_repo" "$stale_repo" "$floor_repo" "$good_repo"
mkdir -p "$cli_good_repo" "$cli_followup_repo" "$cli_floor_repo"

make_repo "0.1.113" "$bad_repo"
git -C "$bad_repo" tag "v0.1.114"
assert_fails_in_repo "$bad_repo" bash "$validator" HEAD

make_repo "0.1.113" "$stale_repo"
git -C "$stale_repo" tag "v0.1.113"
cat >"$stale_repo/package.json" <<'EOF'
{
  "name": "cig-release-test",
  "version": "0.1.114"
}
EOF
git -C "$stale_repo" add package.json
git -C "$stale_repo" commit -q -m "test: bump version for current release"
assert_passes_in_repo "$stale_repo" bash "$validator" HEAD~1

make_repo "0.1.114" "$floor_repo"
git -C "$floor_repo" tag "v0.1.114"
cat >"$floor_repo/package.json" <<'EOF'
{
  "name": "cig-release-test",
  "version": "0.1.113"
}
EOF
git -C "$floor_repo" add package.json
git -C "$floor_repo" commit -q -m "test: move back to older release floor"
git -C "$floor_repo" tag "v0.1.113"
assert_fails_in_repo "$floor_repo" bash "$validator" HEAD

make_repo "0.1.114" "$good_repo"
git -C "$good_repo" tag "v0.1.114"
assert_passes_in_repo "$good_repo" bash "$validator" HEAD

make_cli_repo "0.1.123" "$cli_good_repo"
git -C "$cli_good_repo" tag "cli-v0.1.123"
assert_passes_in_repo "$cli_good_repo" bash "$validator" HEAD

make_cli_repo "0.1.123" "$cli_followup_repo"
git -C "$cli_followup_repo" tag "cli-v0.1.123"
cat >"$cli_followup_repo/packages/cli/README.md" <<'EOF'
# CLI follow-up
EOF
git -C "$cli_followup_repo" add packages/cli/README.md
git -C "$cli_followup_repo" commit -q -m "test: add follow-up commit after cli release"
assert_passes_in_repo "$cli_followup_repo" bash "$validator" HEAD cli-v0.1.123

make_cli_repo "0.1.123" "$cli_floor_repo"
git -C "$cli_floor_repo" tag "cli-v0.1.123"
cat >"$cli_floor_repo/packages/cli/package.json" <<'EOF'
{
  "name": "@cig-technology/cli",
  "version": "0.1.122"
}
EOF
git -C "$cli_floor_repo" add packages/cli/package.json
git -C "$cli_floor_repo" commit -q -m "test: move cli package to older release floor"
git -C "$cli_floor_repo" tag "cli-v0.1.122"
assert_fails_in_repo "$cli_floor_repo" bash "$validator" HEAD

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

bad_repo="${tmpdir}/bad"
good_repo="${tmpdir}/good"
mkdir -p "$bad_repo" "$good_repo"

make_repo "0.1.113" "$bad_repo"
git -C "$bad_repo" tag "v0.1.114"
assert_fails_in_repo "$bad_repo" bash "$validator" HEAD

make_repo "0.1.114" "$good_repo"
git -C "$good_repo" tag "v0.1.114"
assert_passes_in_repo "$good_repo" bash "$validator" HEAD

#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  set -- HEAD
fi

declare -A seen_commits=()
errors=0

validate_commit() {
  local objectish="$1"
  local commit
  local package_version
  local tag
  local release_tags=()

  commit="$(git rev-parse --verify "${objectish}^{commit}")"

  if [[ -n "${seen_commits[$commit]-}" ]]; then
    return 0
  fi
  seen_commits["$commit"]=1

  mapfile -t release_tags < <(git tag --points-at "$commit" || true)
  if [[ "${#release_tags[@]}" -eq 0 ]]; then
    return 0
  fi

  package_version="$(
    git show "${commit}:package.json" | node -e '
const fs = require("node:fs");
const packageJson = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(String(packageJson.version || ""));
'
  )"

  if [[ -z "$package_version" ]]; then
    echo "${commit}: package.json does not contain a valid version string." >&2
    return 1
  fi

  for tag in "${release_tags[@]}"; do
    [[ -z "$tag" ]] && continue

    case "$tag" in
      v[0-9]*.[0-9]*.[0-9]*+build.[0-9]*)
        release_version="${tag#v}"
        release_version="${release_version%%+build.*}"
        ;;
      v[0-9]*.[0-9]*.[0-9]*)
        release_version="${tag#v}"
        ;;
      *)
        continue
        ;;
    esac

    if [[ "$release_version" != "$package_version" ]]; then
      echo "${tag} points to ${commit}, but package.json version is ${package_version} (expected ${release_version})." >&2
      return 1
    fi
  done
}

for ref in "$@"; do
  if ! validate_commit "$ref"; then
    errors=$((errors + 1))
  fi
done

if [[ "$errors" -gt 0 ]]; then
  exit 1
fi

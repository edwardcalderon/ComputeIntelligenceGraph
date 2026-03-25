#!/usr/bin/env bash

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$#" -eq 0 ]]; then
  set -- HEAD
fi

declare -A seen_commits=()
errors=0

compute_release_floor_tag() {
  local tag_prefix="$1"
  shift

  git tag --list "$@" |
    TAG_PREFIX="$tag_prefix" SCRIPT_DIR="$script_dir" node --input-type=module -e '
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const scriptDir = process.env.SCRIPT_DIR;
const tagPrefix = process.env.TAG_PREFIX;

if (!scriptDir) {
  throw new Error("SCRIPT_DIR is required");
}

if (!tagPrefix) {
  throw new Error("TAG_PREFIX is required");
}

const { findHighestReleaseTag } = await import(pathToFileURL(`${scriptDir}/release-version.mjs`));

const tags = fs.readFileSync(0, "utf8").split(/\r?\n/).filter(Boolean);
process.stdout.write(findHighestReleaseTag(tags, tagPrefix));
'
}

root_release_floor_tag="$(
  compute_release_floor_tag 'v' 'v[0-9]*.[0-9]*.[0-9]*' 'v[0-9]*.[0-9]*.[0-9]*+build.[0-9]*'
)"

cli_release_floor_tag="$(
  compute_release_floor_tag 'cli-v' 'cli-v[0-9]*.[0-9]*.[0-9]*' 'cli-v[0-9]*.[0-9]*.[0-9]*+build.[0-9]*'
)"

validate_commit() {
  local objectish="$1"
  local commit
  local head_commit
  local package_version
  local package_json_path
  local tag_prefix
  local floor_tag
  local tag
  local release_tags=()

  commit="$(git rev-parse --verify "${objectish}^{commit}")"
  head_commit="$(git rev-parse --verify HEAD)"

  if [[ -n "${seen_commits[$commit]-}" ]]; then
    return 0
  fi
  seen_commits["$commit"]=1

  mapfile -t release_tags < <(git tag --points-at "$commit" || true)
  if [[ "${#release_tags[@]}" -eq 0 ]]; then
    return 0
  fi

  if [[ "$commit" != "$head_commit" ]]; then
    for tag in "${release_tags[@]}"; do
      [[ -z "$tag" ]] && continue

      case "$tag" in
        v[0-9]*.[0-9]*.[0-9]*+build.[0-9]*|v[0-9]*.[0-9]*.[0-9]*|cli-v[0-9]*.[0-9]*.[0-9]*+build.[0-9]*|cli-v[0-9]*.[0-9]*.[0-9]*)
          echo "${tag} points to ${commit}, but release tags must be pushed from HEAD (${head_commit})." >&2
          return 1
          ;;
      esac
    done
  fi

  for tag in "${release_tags[@]}"; do
    [[ -z "$tag" ]] && continue

    package_json_path=""
    tag_prefix=""
    floor_tag=""

    case "$tag" in
      v[0-9]*.[0-9]*.[0-9]*+build.[0-9]*|v[0-9]*.[0-9]*.[0-9]*)
        package_json_path="package.json"
        tag_prefix="v"
        floor_tag="$root_release_floor_tag"
        ;;
      cli-v[0-9]*.[0-9]*.[0-9]*+build.[0-9]*|cli-v[0-9]*.[0-9]*.[0-9]*)
        package_json_path="packages/cli/package.json"
        tag_prefix="cli-v"
        floor_tag="$cli_release_floor_tag"
        ;;
      *)
        continue
        ;;
    esac

    package_version="$(
      git show "${commit}:${package_json_path}" | node -e '
const fs = require("node:fs");
const packageJson = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(String(packageJson.version || ""));
'
    )"

    if [[ -z "$package_version" ]]; then
      echo "${commit}: ${package_json_path} does not contain a valid version string." >&2
      return 1
    fi

    local floor_args=()

    if [[ -n "$floor_tag" ]]; then
      floor_args+=(--floor-tag "$floor_tag")
    fi

    if [[ -n "$tag_prefix" ]]; then
      floor_args+=(--tag-prefix "$tag_prefix")
    fi

    if ! node "${script_dir}/validate-release-version.mjs" --tag "$tag" --version "$package_version" "${floor_args[@]}" >/dev/null 2>&1; then
      echo "${tag} points to ${commit}, but ${package_json_path} version is ${package_version} and the current release floor is ${floor_tag:-<none>}." >&2
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

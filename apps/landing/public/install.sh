#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'EOF'
Usage: ./install.sh [cig setup flags]

Launches the CIG prerequisite checks and onboarding wizard.
The script prefers a local built CLI, then an installed `cig` binary,
and finally the published npm package.

Web installer:
  curl -fsSL https://cig.lat/install.sh | bash

Install guide:
  https://cig.lat/install
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS_NAME="$(uname -s)"

case "$OS_NAME" in
  Linux|Darwin)
    ;;
  *)
    echo "CIG install.sh supports Linux and macOS only."
    exit 1
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is required."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "Node.js 22+ is required. Detected Node.js ${NODE_MAJOR}."
  exit 1
fi

LOCAL_CLI=""
for candidate_root in "$PWD" "$SCRIPT_ROOT"; do
  if [[ -f "${candidate_root}/packages/cli/dist/index.js" ]]; then
    LOCAL_CLI="${candidate_root}/packages/cli/dist/index.js"
    break
  fi
done

if [[ -n "$LOCAL_CLI" ]]; then
  CLI_CMD=(node "$LOCAL_CLI")
elif command -v cig >/dev/null 2>&1; then
  CLI_CMD=(cig)
else
  CLI_CMD=(npx --yes @cig-technology/cli@latest)
fi

echo "Running CIG prerequisite checks..."
"${CLI_CMD[@]}" doctor

echo "Launching CIG setup wizard..."
"${CLI_CMD[@]}" setup "$@"

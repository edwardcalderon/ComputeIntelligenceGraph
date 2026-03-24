#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

STAGE="${SST_STAGE:-production}"
REPOSITORY="${API_IMAGE_REPOSITORY:?API_IMAGE_REPOSITORY is required}"
PROJECT_TAG="${INFRA_PROJECT_TAG:-cig-api}"
SERVICE_TAG="${INFRA_SERVICE_TAG:-api}"
MANAGED_BY_TAG="${INFRA_MANAGED_BY_TAG:-sst}"
: "${INFRA_API_BOOTSTRAP_ONLY:=true}"
: "${INFRA_CREATE_PIPELINES:=false}"
export INFRA_API_BOOTSTRAP_ONLY INFRA_CREATE_PIPELINES

if aws ecr describe-repositories --repository-names "$REPOSITORY" >/dev/null 2>&1; then
  echo "ECR repository '$REPOSITORY' already exists; skipping bootstrap."
  exit 0
fi

echo "ECR repository '$REPOSITORY' is missing; checking SST stage '$STAGE'."

# Only a missing SST stage should go through `sst deploy` in bootstrap mode.
# Running bootstrap against an existing stage would prune the runtime stack.
diff_output=""
if diff_output="$(pnpm exec sst diff --stage "$STAGE" 2>&1)"; then
  echo "SST stage '$STAGE' already exists; recreating the ECR repository directly."
  aws ecr create-repository \
    --repository-name "$REPOSITORY" \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability MUTABLE \
    --tags \
      Key=project,Value="$PROJECT_TAG" \
      Key=service,Value="$SERVICE_TAG" \
      Key=stage,Value="$STAGE" \
      Key=managedBy,Value="$MANAGED_BY_TAG" >/dev/null
  exit 0
fi

if grep -qi 'Stage not found' <<<"$diff_output"; then
  echo "No SST stage found for '$STAGE'; bootstrapping through SST."
  pnpm exec sst deploy --stage "$STAGE" --yes
  exit 0
fi

echo "Failed to inspect SST stage '$STAGE'." >&2
echo "$diff_output" >&2
exit 1

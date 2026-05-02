"use client";

import { useQuery } from "@tanstack/react-query";
import { ConfigGroup } from "../../../../components/gpu/ConfigGroup";
import { ErrorState } from "../../../../components/gpu/ErrorState";
import { SkeletonLoader } from "../../../../components/gpu/SkeletonLoader";
import { getGpuConfig } from "../../../../lib/gpuApi";
import { gpuKeys } from "../../../../lib/gpuUtils";

/**
 * GPU Config View page at `/gpu/config`.
 *
 * Displays the orchestrator configuration as grouped key-value lists
 * using ConfigGroup components. Sensitive values are shown redacted
 * as returned by the API.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.1, 12.2
 */
export default function GpuConfigPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: gpuKeys.config,
    queryFn: () => getGpuConfig(),
    staleTime: 60_000,
  });

  // Loading state — skeleton cards matching the 4 config groups
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Loading orchestrator configuration…
          </p>
        </div>
        <SkeletonLoader variant="cards" rows={4} />
      </div>
    );
  }

  // Error state (Req 6.5, 12.2)
  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuration
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Current GPU orchestrator configuration.
          </p>
        </div>
        <ErrorState
          message="Failed to load configuration. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const config = data!;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Configuration
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Current GPU orchestrator configuration. Sensitive values are redacted.
        </p>
      </div>

      {/* Config groups — responsive grid (Req 6.1, 6.3, 6.4, 11.1) */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <ConfigGroup title="Provider Settings" entries={config.providerSettings} />
        <ConfigGroup title="AWS Settings" entries={config.awsSettings} />
        <ConfigGroup title="Health Check Settings" entries={config.healthCheckSettings} />
        <ConfigGroup title="Logging Settings" entries={config.loggingSettings} />
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "../../components/StatCard";
import {
  getResourcesPaged,
  getDiscoveryStatus,
  PagedResources,
  DiscoveryStatus,
} from "../../lib/api";

const WS_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(
    /^http/,
    "ws"
  ) + "/ws";

const RESOURCE_TYPES = ["compute", "storage", "network", "database"] as const;
const PROVIDERS = ["aws", "gcp", "kubernetes", "docker"] as const;

function fmt(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString();
}

export default function OverviewPage() {
  const queryClient = useQueryClient();

  // Total count (limit=1 is enough — we only need `total`)
  const { data: totalData, isLoading: totalLoading } =
    useQuery<PagedResources>({
      queryKey: ["resources", "total"],
      queryFn: () => getResourcesPaged("limit=1"),
    });

  // Counts by type
  const typeQueries = RESOURCE_TYPES.map((type) => ({
    type,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    result: useQuery<PagedResources>({
      queryKey: ["resources", "type", type],
      queryFn: () => getResourcesPaged(`limit=1&type=${type}`),
    }),
  }));

  // Counts by provider
  const providerQueries = PROVIDERS.map((provider) => ({
    provider,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    result: useQuery<PagedResources>({
      queryKey: ["resources", "provider", provider],
      queryFn: () => getResourcesPaged(`limit=1&provider=${provider}`),
    }),
  }));

  // Inactive count
  const { data: inactiveData, isLoading: inactiveLoading } =
    useQuery<PagedResources>({
      queryKey: ["resources", "state", "inactive"],
      queryFn: () => getResourcesPaged("limit=1&state=inactive"),
    });

  // Discovery status
  const { data: discoveryData, isLoading: discoveryLoading } =
    useQuery<DiscoveryStatus>({
      queryKey: ["discovery", "status"],
      queryFn: getDiscoveryStatus,
      refetchInterval: 30_000,
    });

  // WebSocket for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string };
          if (
            msg.type === "resource_updated" ||
            msg.type === "discovery_complete"
          ) {
            queryClient.invalidateQueries({ queryKey: ["resources"] });
            queryClient.invalidateQueries({ queryKey: ["discovery"] });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5_000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [queryClient]);

  // Derive region counts from total data (regions not filterable via simple query;
  // we show a breakdown from the items we have)
  const { data: regionSampleData } = useQuery<PagedResources>({
    queryKey: ["resources", "region-sample"],
    queryFn: () => getResourcesPaged("limit=200"),
  });

  const regionCounts = regionSampleData?.items.reduce<Record<string, number>>(
    (acc, r) => {
      const region = r.region ?? "unknown";
      acc[region] = (acc[region] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Infrastructure at a glance
        </p>
      </div>

      {/* Total */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Total Resources
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="All resources"
            value={totalData?.total ?? 0}
            loading={totalLoading}
          />
          <StatCard
            label="Inactive"
            value={inactiveData?.total ?? 0}
            loading={inactiveLoading}
            sub="stopped / terminated"
          />
        </div>
      </section>

      {/* By type */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          By Type
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {typeQueries.map(({ type, result }) => (
            <StatCard
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              value={result.data?.total ?? 0}
              loading={result.isLoading}
            />
          ))}
        </div>
      </section>

      {/* By provider */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          By Provider
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {providerQueries.map(({ provider, result }) => (
            <StatCard
              key={provider}
              label={provider.toUpperCase()}
              value={result.data?.total ?? 0}
              loading={result.isLoading}
            />
          ))}
        </div>
      </section>

      {/* By region */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          By Region
        </h2>
        {!regionCounts || Object.keys(regionCounts).length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No region data available.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(regionCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([region, count]) => (
                <StatCard key={region} label={region} value={count} />
              ))}
          </div>
        )}
      </section>

      {/* Discovery status */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Discovery
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Status"
            value={
              discoveryLoading
                ? "…"
                : discoveryData?.running
                ? "Running"
                : "Idle"
            }
            loading={discoveryLoading}
          />
          <StatCard
            label="Last run"
            value={fmt(discoveryData?.lastRun ?? null)}
            loading={discoveryLoading}
          />
          <StatCard
            label="Next run"
            value={fmt(discoveryData?.nextRun ?? null)}
            loading={discoveryLoading}
          />
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "../../components/StatCard";
import { getResourcesPaged, getDiscoveryStatus, PagedResources, DiscoveryStatus } from "../../lib/api";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/^http/, "ws") + "/ws";
const RESOURCE_TYPES = ["compute", "storage", "network", "database"] as const;
const PROVIDERS = ["aws", "gcp", "kubernetes", "docker"] as const;
const TYPE_COLORS: Record<string, string> = { compute: "#06b6d4", storage: "#3b82f6", network: "#a855f7", database: "#10b981" };
const PROVIDER_COLORS: Record<string, string> = { aws: "#f59e0b", gcp: "#3b82f6", kubernetes: "#06b6d4", docker: "#8b5cf6" };

function fmt(date: string | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleString();
}

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { data: totalData, isLoading: totalLoading } = useQuery<PagedResources>({ queryKey: ["resources", "total"], queryFn: () => getResourcesPaged("limit=1") });
  const typeQueries = useQueries({
    queries: RESOURCE_TYPES.map((type) => ({
      queryKey: ["resources", "type", type],
      queryFn: () => getResourcesPaged(`limit=1&type=${type}`),
    })),
  });
  const providerQueries = useQueries({
    queries: PROVIDERS.map((provider) => ({
      queryKey: ["resources", "provider", provider],
      queryFn: () => getResourcesPaged(`limit=1&provider=${provider}`),
    })),
  });
  const { data: inactiveData, isLoading: inactiveLoading } = useQuery<PagedResources>({ queryKey: ["resources", "state", "inactive"], queryFn: () => getResourcesPaged("limit=1&state=inactive") });
  const { data: discoveryData, isLoading: discoveryLoading } = useQuery<DiscoveryStatus>({ queryKey: ["discovery", "status"], queryFn: getDiscoveryStatus, refetchInterval: 30_000 });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => { try { const msg = JSON.parse(event.data as string) as { type: string }; if (msg.type === "resource_updated" || msg.type === "discovery_complete") { queryClient.invalidateQueries({ queryKey: ["resources"] }); queryClient.invalidateQueries({ queryKey: ["discovery"] }); } } catch {} };
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 5_000); };
      ws.onerror = () => { ws?.close(); };
    }
    connect();
    return () => { if (reconnectTimer) clearTimeout(reconnectTimer); ws?.close(); };
  }, [queryClient]);

  const { data: regionSampleData } = useQuery<PagedResources>({ queryKey: ["resources", "region-sample"], queryFn: () => getResourcesPaged("limit=200") });
  const regionCounts = regionSampleData?.items.reduce<Record<string, number>>((acc, r) => { const region = r.region ?? "unknown"; acc[region] = (acc[region] ?? 0) + 1; return acc; }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-cig-primary">Overview</h1>
        <p className="mt-1 text-sm text-cig-secondary">Infrastructure at a glance</p>
      </div>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-cig-muted">Total Resources</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="All resources" value={totalData?.total ?? 0} loading={totalLoading} color="#06b6d4" />
          <StatCard label="Inactive" value={inactiveData?.total ?? 0} loading={inactiveLoading} sub="stopped / terminated" color="#ef4444" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-cig-muted">By Type</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RESOURCE_TYPES.map((type, index) => (
            <StatCard key={type} label={type.charAt(0).toUpperCase() + type.slice(1)} value={typeQueries[index]?.data?.total ?? 0} loading={typeQueries[index]?.isLoading ?? false} color={TYPE_COLORS[type]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-cig-muted">By Provider</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PROVIDERS.map((provider, index) => (
            <StatCard key={provider} label={provider.toUpperCase()} value={providerQueries[index]?.data?.total ?? 0} loading={providerQueries[index]?.isLoading ?? false} color={PROVIDER_COLORS[provider]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-cig-muted">By Region</h2>
        {!regionCounts || Object.keys(regionCounts).length === 0 ? (
          <p className="text-sm text-cig-muted">No region data available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).map(([region, count]) => (
              <StatCard key={region} label={region} value={count} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-cig-muted">Discovery</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Status" value={discoveryLoading ? "\u2026" : discoveryData?.running ? "Running" : "Idle"} loading={discoveryLoading} color="#10b981" />
          <StatCard label="Last run" value={fmt(discoveryData?.lastRun ?? null)} loading={discoveryLoading} />
          <StatCard label="Next run" value={fmt(discoveryData?.nextRun ?? null)} loading={discoveryLoading} />
        </div>
      </section>
    </div>
  );
}

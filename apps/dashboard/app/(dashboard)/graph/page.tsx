"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@cig-technology/i18n/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Position,
  Handle,
  NodeProps,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { getGraphSnapshot, type GraphSnapshot, type Resource, type Relationship } from "../../../lib/api";
import { buildAuthenticatedWebSocketUrl } from "../../../lib/browserApi";
import { PROVIDER_COLORS, PROVIDER_LABELS, getProviderColor } from "../../../lib/providers";
import { useDashboardGraphSource } from "../../../lib/useGraphSource";
import { isLoopbackHostname } from "../../../lib/siteUrl";
import { shouldAutoUseDemoGraphSource } from "../../../lib/graphSource";
import type { Graph3DLink, Graph3DNode } from "../../../components/Graph3DCanvas";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  compute: { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
  storage: { bg: "#dcfce7", border: "#22c55e", text: "#15803d" },
  network: { bg: "#f3e8ff", border: "#a855f7", text: "#7e22ce" },
  database: { bg: "#ffedd5", border: "#f97316", text: "#c2410c" },
  service: { bg: "#e0f2fe", border: "#06b6d4", text: "#0e7490" },
  default: { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" },
};

const TYPES = ["compute", "storage", "network", "database", "service"] as const;
const PROVIDERS = ["aws", "gcp", "kubernetes", "docker"] as const;

const COLS = 8;
const H_GAP = 200;
const V_GAP = 120;

const EMPTY_GRAPH: GraphSnapshot = {
  source: {
    kind: "live",
    available: false,
    lastSyncedAt: null,
  },
  resourceCounts: {},
  resources: [],
  relationships: [],
  discovery: {
    healthy: false,
    running: false,
    lastRun: null,
    nextRun: null,
  },
};

const Graph3DModeCanvas = dynamic(
  () => import("../../../components/Graph3DCanvas"),
  {
    ssr: false,
    loading: () => <GraphLoadingFallback />,
  },
);

// ─── Custom Node ──────────────────────────────────────────────────────────────

interface ResourceNodeData {
  resource: Resource;
  highlighted: boolean;
  dimmed: boolean;
}

function ResourceNode({ data }: NodeProps<ResourceNodeData>) {
  const { resource, highlighted, dimmed } = data;
  const colors = TYPE_COLORS[resource.type] ?? TYPE_COLORS.default;
  const providerColor = getProviderColor(resource.provider);

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${highlighted ? "#f59e0b" : providerColor}`,
        opacity: dimmed ? 0.3 : 1,
        transition: "opacity 0.2s, border-color 0.2s",
        borderRadius: 8,
        padding: "6px 10px",
        minWidth: 140,
        maxWidth: 160,
        cursor: "pointer",
        boxShadow: highlighted ? "0 0 0 3px rgba(245,158,11,0.4)" : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontSize: 10, color: colors.text, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {resource.type}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {resource.name || resource.id}
      </div>
      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: providerColor,
            flexShrink: 0,
          }}
        />
        {resource.provider.toUpperCase()} {resource.region ? `· ${resource.region}` : ""}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { resource: ResourceNode };

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const t = useTranslation();
  const colors = TYPE_COLORS[resource.type] ?? TYPE_COLORS.default;
  return (
    <div className="absolute right-2 top-12 z-10 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold uppercase"
          style={{ background: colors.bg, color: colors.text }}
        >
          {resource.type}
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label={t("common.close")}
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 p-4 text-sm max-h-[60vh] overflow-y-auto">
        <div>
          <span className="text-xs font-semibold uppercase text-gray-400">{t("graph.detailName")}</span>
          <p className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{resource.name || "—"}</p>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase text-gray-400">{t("graph.detailId")}</span>
          <p className="mt-0.5 font-mono text-xs text-gray-600 dark:text-gray-300 break-all">{resource.id}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs font-semibold uppercase text-gray-400">{t("graph.detailProvider")}</span>
            <p className="mt-0.5 text-gray-700 dark:text-gray-300 uppercase">{resource.provider}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase text-gray-400">{t("graph.detailRegion")}</span>
            <p className="mt-0.5 text-gray-700 dark:text-gray-300">{resource.region ?? "—"}</p>
          </div>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase text-gray-400">{t("graph.detailState")}</span>
          <p className="mt-0.5 text-gray-700 dark:text-gray-300">{resource.state ?? "—"}</p>
        </div>
        {resource.tags && Object.keys(resource.tags).length > 0 && (
          <div>
            <span className="text-xs font-semibold uppercase text-gray-400">{t("graph.detailTags")}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(resource.tags).map(([k, v]) => (
                <span key={k} className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {k}={v}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildGraphState(snapshot: GraphSnapshot, filterType: string, filterProvider: string) {
  const filteredResources = snapshot.resources.filter((resource) => {
    if (filterType && resource.type !== filterType) return false;
    if (filterProvider && resource.provider !== filterProvider) return false;
    return true;
  });

  const visibleIds = new Set(filteredResources.map((resource) => resource.id));
  const filteredRelationships = snapshot.relationships.filter(
    (relationship) => visibleIds.has(relationship.sourceId) && visibleIds.has(relationship.targetId),
  );

  return { filteredResources, filteredRelationships };
}

function buildRelationshipLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}

// ─── Graph Content ────────────────────────────────────────────────────────────

function GraphContent() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const wsUrl = buildAuthenticatedWebSocketUrl();
  const [graphSource, setGraphSource] = useDashboardGraphSource();
  const [hostname, setHostname] = useState<string | null>(null);
  const autoDemoFallbackApplied = useRef(false);

  const [filterType, setFilterType] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [graphMode, setGraphMode] = useState<"2d" | "3d">("2d");

  const { data: snapshotData } = useQuery({
    queryKey: ["graph", "snapshot", graphSource],
    queryFn: async () => {
      try {
        return await getGraphSnapshot(graphSource);
      } catch {
        return EMPTY_GRAPH;
      }
    },
  });

  const snapshot = snapshotData ?? EMPTY_GRAPH;
  const isLoopback = Boolean(hostname && isLoopbackHostname(hostname));
  const shouldAutoSwitchToDemo = shouldAutoUseDemoGraphSource(hostname, graphSource, snapshot);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setHostname(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!shouldAutoSwitchToDemo || autoDemoFallbackApplied.current) {
      return;
    }

    autoDemoFallbackApplied.current = true;
    setGraphSource("demo");
  }, [setGraphSource, shouldAutoSwitchToDemo]);

  const { filteredResources, filteredRelationships } = useMemo(
    () => buildGraphState(snapshot, filterType, filterProvider),
    [filterProvider, filterType, snapshot],
  );

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const rel of filteredRelationships) {
      if (!map.has(rel.sourceId)) map.set(rel.sourceId, new Set());
      if (!map.has(rel.targetId)) map.set(rel.targetId, new Set());
      map.get(rel.sourceId)!.add(rel.targetId);
      map.get(rel.targetId)!.add(rel.sourceId);
    }
    return map;
  }, [filteredRelationships]);

  const neighbors = useMemo(() => {
    if (!selectedId) return null;
    return adjacency.get(selectedId) ?? new Set<string>();
  }, [adjacency, selectedId]);

  const nodes = useMemo<Array<Node<ResourceNodeData>>>(() => {
    return filteredResources.map((resource, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const highlighted = selectedId !== null && (resource.id === selectedId || (neighbors?.has(resource.id) ?? false));
      const dimmed = selectedId !== null && !highlighted;
      return {
        id: resource.id,
        type: "resource",
        position: { x: col * H_GAP, y: row * V_GAP },
        data: { resource, highlighted, dimmed },
        draggable: true,
      };
    });
  }, [filteredResources, neighbors, selectedId]);

  const edges = useMemo<Array<Edge>>(() => {
    const resourceIds = new Set(filteredResources.map((resource) => resource.id));
    return filteredRelationships
      .filter((rel) => resourceIds.has(rel.sourceId) && resourceIds.has(rel.targetId))
      .map((rel, index) => {
        const highlighted =
          selectedId !== null &&
          (rel.sourceId === selectedId || rel.targetId === selectedId || neighbors?.has(rel.sourceId) || neighbors?.has(rel.targetId));
        const dimmed = selectedId !== null && !highlighted;
        return {
          id: `e-${index}-${rel.sourceId}-${rel.targetId}`,
          source: rel.sourceId,
          target: rel.targetId,
          label: buildRelationshipLabel(rel.type),
          animated: rel.type.toLowerCase().includes("depend"),
          style: {
            stroke: rel.type.toLowerCase().includes("depend")
              ? "#f97316"
              : rel.type.toLowerCase().includes("contain")
                ? "#3b82f6"
                : "#9ca3af",
            strokeWidth: highlighted ? 2.25 : 1.5,
            opacity: dimmed ? 0.15 : highlighted ? 0.95 : 0.8,
          },
        };
      });
  }, [filteredRelationships, filteredResources, neighbors, selectedId]);

  const graph3DNodes = useMemo<Graph3DNode[]>(() => {
    return filteredResources.map((resource) => {
      const highlighted = selectedId !== null && (resource.id === selectedId || (neighbors?.has(resource.id) ?? false));
      const dimmed = selectedId !== null && !highlighted;
      return {
        id: resource.id,
        resource,
        highlighted,
        dimmed,
      };
    });
  }, [filteredResources, neighbors, selectedId]);

  const graph3DLinks = useMemo<Graph3DLink[]>(() => {
    const resourceIds = new Set(filteredResources.map((resource) => resource.id));
    return filteredRelationships
      .filter((rel) => resourceIds.has(rel.sourceId) && resourceIds.has(rel.targetId))
      .map((rel) => {
        const highlighted = Boolean(
          selectedId !== null &&
          (rel.sourceId === selectedId ||
            rel.targetId === selectedId ||
            neighbors?.has(rel.sourceId) ||
            neighbors?.has(rel.targetId)),
        );
        const dimmed = Boolean(selectedId !== null && !highlighted);
        return {
          id: `g3d-${rel.sourceId}-${rel.type}-${rel.targetId}`,
          source: rel.sourceId,
          target: rel.targetId,
          label: buildRelationshipLabel(rel.type),
          highlighted,
          dimmed,
          color: rel.type.toLowerCase().includes("depend")
            ? "#f97316"
            : rel.type.toLowerCase().includes("contain")
              ? "#3b82f6"
              : "#9ca3af",
        };
      });
  }, [filteredRelationships, filteredResources, neighbors, selectedId]);

  useEffect(() => {
    if (!wsUrl) {
      return;
    }

    const resolvedWsUrl = wsUrl;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(resolvedWsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string };
          if (msg.type === "resource_updated" || msg.type === "discovery_complete") {
            queryClient.invalidateQueries({ queryKey: ["graph", "snapshot"] });
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        timer = setTimeout(connect, 5_000);
      };
      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();
    return () => {
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [queryClient, wsUrl]);

  const selectedResource = useMemo(
    () => filteredResources.find((resource) => resource.id === selectedId) ?? null,
    [filteredResources, selectedId],
  );

  const isDemoSource = graphSource === "demo";
  const liveUnavailable = !isDemoSource && !snapshot.source.available;
  const showLocalDemoFallback = isLoopback && liveUnavailable && !isDemoSource;
  const sourceLabel = isDemoSource ? "Demo workspace" : liveUnavailable ? "Live unavailable" : "Live discovery";
  const sourceBadgeClass = isDemoSource
    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300"
    : liveUnavailable
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300";

  const visibleNodeCount = filteredResources.length;
  const visibleEdgeCount = filteredRelationships.length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-slate-900 sm:gap-3 sm:px-4 sm:py-3">
        <div className="mr-auto flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">{t("graph.title")}</h1>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${sourceBadgeClass}`}>
              {sourceLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("graph.nodeCount", { nodes: visibleNodeCount })} · {t("graph.edgeCount", { edges: visibleEdgeCount })}
          </p>
        </div>

        <div className="flex min-w-[11rem] flex-shrink-0 flex-col gap-1 rounded-2xl border border-gray-200 bg-gray-50 px-2 py-2 dark:border-gray-700 dark:bg-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
            Graph source
          </span>
          <div className="flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-slate-900">
            {(["live", "demo"] as const).map((source) => (
              <button
                key={source}
                type="button"
                aria-pressed={graphSource === source}
                onClick={() => setGraphSource(source)}
                className={[
                  "flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                  graphSource === source
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                ].join(" ")}
              >
                {source === "live" ? "LIVE" : "DEMO"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-slate-800">
          {(["2d", "3d"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGraphMode(mode)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition-colors",
                graphMode === mode
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
              ].join(" ")}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>

        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setSelectedId(null);
          }}
          className="flex-shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          <option value="">{t("graph.allTypes")}</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filterProvider}
          onChange={(e) => {
            setFilterProvider(e.target.value);
            setSelectedId(null);
          }}
          className="flex-shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          <option value="">{t("graph.allProviders")}</option>
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider.toUpperCase()}
            </option>
          ))}
        </select>

        {(filterType || filterProvider) && (
          <button
            type="button"
            onClick={() => {
              setFilterType("");
              setFilterProvider("");
              setSelectedId(null);
            }}
            className="flex-shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            {t("graph.clear")}
          </button>
        )}

        <div className="hidden items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-700 sm:flex">
          {Object.entries(TYPE_COLORS)
            .filter(([key]) => key !== "default")
            .map(([type, colors]) => (
              <span key={type} className="flex items-center gap-1 text-xs">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors.border }} />
                {type}
              </span>
            ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 w-full overflow-hidden">
        {graphMode === "2d" ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={(_, node) => setSelectedId((prev) => (prev === node.id ? null : node.id))}
            onPaneClick={() => setSelectedId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
            attributionPosition="bottom-left"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const resource = (node.data as ResourceNodeData | undefined)?.resource;
                return resource ? getProviderColor(resource.provider) : PROVIDER_COLORS.default;
              }}
              maskColor="rgba(0,0,0,0.05)"
            />
          </ReactFlow>
        ) : (
          <Graph3DModeCanvas
            nodes={graph3DNodes}
            links={graph3DLinks}
            selectedId={selectedId}
            onNodeClick={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />
        )}

        {liveUnavailable && !showLocalDemoFallback && (
          <div className="absolute left-1/2 top-4 z-10 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-lg backdrop-blur dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Live discovery is unavailable.</p>
                <p className="text-xs opacity-90">
                  Switch to Demo to inspect the seeded workspace while the live Neo4j connection is offline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGraphSource("demo")}
                className="self-start rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-sm transition-colors hover:bg-amber-500"
              >
                Switch to Demo
              </button>
            </div>
          </div>
        )}

        {showLocalDemoFallback && (
          <div className="absolute left-1/2 top-4 z-10 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-violet-200 bg-violet-50/95 px-4 py-3 text-sm text-violet-900 shadow-lg backdrop-blur dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Showing demo workspace for local development.</p>
                <p className="text-xs opacity-90">
                  Live discovery is offline here, so the graph auto-switched to the seeded demo data.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGraphSource("demo")}
                className="self-start rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-sm transition-colors hover:bg-violet-500"
              >
                Keep Demo
              </button>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute right-2 top-2 z-10 max-w-xs rounded-lg border border-gray-200 bg-white/90 px-2 py-1.5 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90 sm:right-4 sm:top-4 sm:px-3 sm:py-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t("graph.providers")}
          </p>
          <div className="space-y-0.5 sm:space-y-1">
            {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: PROVIDER_COLORS[key] }}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {visibleNodeCount === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="max-w-sm rounded-3xl border border-dashed border-gray-300 bg-white/85 px-6 py-6 text-center shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/85">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t("graph.noResources")}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                {isDemoSource
                  ? "The demo workspace is empty or has not been seeded yet."
                  : "Discovery-backed resources will appear here once the graph is indexed."}
              </p>
              {isDemoSource ? null : (
                <button
                  type="button"
                  onClick={() => setGraphSource("demo")}
                  className="mt-4 rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300"
                >
                  Switch to Demo
                </button>
              )}
            </div>
          </div>
        )}

        {selectedResource && <DetailPanel resource={selectedResource} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

function GraphLoadingFallback() {
  const t = useTranslation();

  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      {t("graph.loadingGraph")}
    </div>
  );
}

export default function GraphPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Suspense fallback={<GraphLoadingFallback />}>
        <GraphContent />
      </Suspense>
    </div>
  );
}

"use client";

import { useEffect, useCallback, useState, useMemo, Suspense } from "react";
import { useTranslation } from "@cig-technology/i18n/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { getResourcesPaged, Resource } from "../../../lib/api";
import { PROVIDER_COLORS, PROVIDER_LABELS, getProviderColor } from "../../../lib/providers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Relationship {
  sourceId: string;
  targetId: string;
  type: string;
}

interface ResourceNodeData {
  resource: Resource;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  compute:  { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
  storage:  { bg: "#dcfce7", border: "#22c55e", text: "#15803d" },
  network:  { bg: "#f3e8ff", border: "#a855f7", text: "#7e22ce" },
  database: { bg: "#ffedd5", border: "#f97316", text: "#c2410c" },
  default:  { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" },
};

const TYPES = ["compute", "storage", "network", "database"] as const;
const PROVIDERS = ["aws", "gcp", "kubernetes", "docker"] as const;

const COLS = 8;
const H_GAP = 200;
const V_GAP = 120;

// ─── Custom Node ──────────────────────────────────────────────────────────────

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

const nodeTypes: NodeTypes = { resource: ResourceNode };

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const t = useTranslation();
  const colors = TYPE_COLORS[resource.type] ?? TYPE_COLORS.default;
  return (
    <div className="absolute right-4 top-4 z-10 w-72 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
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
      <div className="space-y-2 p-4 text-sm">
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

// ─── Graph Content ────────────────────────────────────────────────────────────

function GraphContent() {
  const t = useTranslation();
  const queryClient = useQueryClient();

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterProvider, setFilterProvider] = useState("");

  // Selected node for detail panel + dependency highlighting
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<ResourceNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch resources (up to 500)
  const { data: resourceData } = useQuery({
    queryKey: ["graph", "resources", filterType, filterProvider],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "500" });
      if (filterType) p.set("type", filterType);
      if (filterProvider) p.set("provider", filterProvider);
      return getResourcesPaged(p.toString());
    },
  });

  // Fetch relationships
  const { data: relData } = useQuery<{ items: Relationship[] }>({
    queryKey: ["graph", "relationships"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/relationships?limit=1000`);
        if (!res.ok) return { items: [] };
        return res.json() as Promise<{ items: Relationship[] }>;
      } catch {
        return { items: [] };
      }
    },
  });

  const resources = useMemo(() => resourceData?.items ?? [], [resourceData]);
  const relationships = useMemo(() => relData?.items ?? [], [relData]);

  // Build adjacency for highlighting
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const rel of relationships) {
      if (!map.has(rel.sourceId)) map.set(rel.sourceId, new Set());
      if (!map.has(rel.targetId)) map.set(rel.targetId, new Set());
      map.get(rel.sourceId)!.add(rel.targetId);
      map.get(rel.targetId)!.add(rel.sourceId);
    }
    return map;
  }, [relationships]);

  const neighbors = useMemo(() => {
    if (!selectedId) return null;
    return adjacency.get(selectedId) ?? new Set<string>();
  }, [selectedId, adjacency]);

  // Build nodes
  useEffect(() => {
    const newNodes: Node<ResourceNodeData>[] = resources.map((r, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const highlighted = selectedId !== null && (r.id === selectedId || (neighbors?.has(r.id) ?? false));
      const dimmed = selectedId !== null && !highlighted;
      return {
        id: r.id,
        type: "resource",
        position: { x: col * H_GAP, y: row * V_GAP },
        data: { resource: r, selected: r.id === selectedId, highlighted, dimmed },
        draggable: true,
      };
    });
    setNodes(newNodes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, selectedId, neighbors]);

  // Build edges
  useEffect(() => {
    const resourceIds = new Set(resources.map((r) => r.id));
    const newEdges: Edge[] = relationships
      .filter((rel) => resourceIds.has(rel.sourceId) && resourceIds.has(rel.targetId))
      .map((rel, i) => ({
        id: `e-${i}-${rel.sourceId}-${rel.targetId}`,
        source: rel.sourceId,
        target: rel.targetId,
        label: rel.type,
        animated: rel.type === "depends_on",
        style: {
          stroke: rel.type === "depends_on" ? "#f97316" : rel.type === "contains" ? "#3b82f6" : "#9ca3af",
          strokeWidth: 1.5,
          opacity: selectedId && !neighbors?.has(rel.sourceId) && !neighbors?.has(rel.targetId) && rel.sourceId !== selectedId && rel.targetId !== selectedId ? 0.15 : 0.8,
        },
      }));
    setEdges(newEdges);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships, resources, selectedId, neighbors]);

  // WebSocket real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string };
          if (msg.type === "resource_updated" || msg.type === "discovery_complete") {
            queryClient.invalidateQueries({ queryKey: ["graph"] });
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { timer = setTimeout(connect, 5_000); };
      ws.onerror = () => { ws?.close(); };
    }

    connect();
    return () => {
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [queryClient]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<ResourceNodeData>) => {
    setSelectedId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const selectedResource = useMemo(
    () => resources.find((r) => r.id === selectedId) ?? null,
    [resources, selectedId]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header + Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t("graph.title")}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("graph.nodeCount", { nodes: resources.length })} · {t("graph.edgeCount", { edges: edges.length })}
          </p>
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setSelectedId(null); }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{t("graph.allTypes")}</option>
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>{tp.charAt(0).toUpperCase() + tp.slice(1)}</option>
          ))}
        </select>

        {/* Provider filter */}
        <select
          value={filterProvider}
          onChange={(e) => { setFilterProvider(e.target.value); setSelectedId(null); }}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">{t("graph.allProviders")}</option>
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>{p.toUpperCase()}</option>
          ))}
        </select>

        {(filterType || filterProvider) && (
          <button
            onClick={() => { setFilterType(""); setFilterProvider(""); setSelectedId(null); }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {t("graph.clear")}
          </button>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-700">
          {Object.entries(TYPE_COLORS).filter(([k]) => k !== "default").map(([type, c]) => (
            <span key={type} className="flex items-center gap-1 text-xs">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.border }} />
              {type}
            </span>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
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
            nodeColor={(n) => {
              const r = (n.data as ResourceNodeData)?.resource;
              return r ? getProviderColor(r.provider) : PROVIDER_COLORS.default;
            }}
            maskColor="rgba(0,0,0,0.05)"
          />
        </ReactFlow>

        {/* Provider legend */}
        <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("graph.providers")}</p>
          <div className="space-y-1">
            {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PROVIDER_COLORS[key] }}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {resources.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400">{t("graph.noResources")}</p>
          </div>
        )}

        {/* Detail panel */}
        {selectedResource && (
          <DetailPanel resource={selectedResource} onClose={() => setSelectedId(null)} />
        )}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GraphPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <Suspense fallback={<GraphLoadingFallback />}>
        <GraphContent />
      </Suspense>
    </div>
  );
}

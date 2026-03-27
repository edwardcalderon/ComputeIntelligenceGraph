"use client";

import { memo, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { Resource } from "../lib/api";
import { getProviderColor } from "../lib/providers";

export interface Graph3DNode {
  id: string;
  resource: Resource;
  highlighted: boolean;
  dimmed: boolean;
}

export interface Graph3DLink {
  id: string;
  source: string;
  target: string;
  label: string;
  highlighted: boolean;
  dimmed: boolean;
  color: string;
}

export function Graph3DCanvas({
  nodes,
  links,
  selectedId,
  onNodeClick,
}: {
  nodes: Graph3DNode[];
  links: Graph3DLink[];
  selectedId: string | null;
  onNodeClick: (id: string) => void;
}) {
  const graphData = useMemo(
    () => ({ nodes, links }),
    [links, nodes],
  );

  return (
    <div className="relative h-full w-full rounded-2xl border border-slate-200/70 bg-slate-950/95 shadow-[0_20px_80px_rgba(15,23,42,0.35)] ring-1 ring-white/5 dark:border-zinc-800/70">
      <ForceGraph3D
        graphData={graphData}
        backgroundColor="#020617"
        nodeId="id"
        nodeLabel={(node: unknown) => {
          const resource = (node as Graph3DNode).resource;
          return `${resource.name || resource.id} · ${resource.type} · ${resource.provider}${resource.region ? ` · ${resource.region}` : ""}`;
        }}
        linkLabel={(link: unknown) => (link as Graph3DLink).label}
        nodeRelSize={5}
        nodeVal={(node: unknown) => ((node as Graph3DNode).highlighted ? 7 : 4)}
        nodeOpacity={(node: unknown) => ((node as Graph3DNode).dimmed ? 0.2 : 0.95)}
        linkOpacity={(link: unknown) => ((link as Graph3DLink).dimmed ? 0.08 : 0.35)}
        nodeColor={(node: unknown) => {
          const graphNode = node as Graph3DNode;
          const resource = graphNode.resource;
          return graphNode.highlighted ? "#f59e0b" : getProviderColor(resource.provider);
        }}
        linkColor={(link: unknown) => (link as Graph3DLink).color}
        linkWidth={(link: unknown) => ((link as Graph3DLink).highlighted ? 2 : 1)}
        linkDirectionalParticles={(link: unknown) => ((link as Graph3DLink).highlighted ? 2 : 0)}
        linkDirectionalParticleWidth={2}
        enableNodeDrag
        onNodeClick={(node: unknown) => {
          const graphNode = node as Graph3DNode;
          onNodeClick(graphNode.id);
        }}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
        3D force graph
      </div>
      {selectedId ? (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200 backdrop-blur">
          Selected
        </div>
      ) : null}
    </div>
  );
}

export default memo(Graph3DCanvas);

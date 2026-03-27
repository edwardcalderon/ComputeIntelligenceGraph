declare module "react-force-graph-3d" {
  import type { ComponentType, ReactNode } from "react";

  export interface ForceGraph3DProps {
    graphData?: {
      nodes?: unknown[];
      links?: unknown[];
    };
    backgroundColor?: string;
    nodeId?: string;
    nodeLabel?: (node: unknown) => ReactNode;
    linkLabel?: (link: unknown) => ReactNode;
    nodeRelSize?: number;
    nodeVal?: (node: unknown) => number;
    nodeOpacity?: (node: unknown) => number;
    linkOpacity?: (link: unknown) => number;
    nodeColor?: (node: unknown) => string;
    linkColor?: (link: unknown) => string;
    linkWidth?: (link: unknown) => number;
    linkDirectionalParticles?: (link: unknown) => number;
    linkDirectionalParticleWidth?: number;
    enableNodeDrag?: boolean;
    onNodeClick?: (node: unknown) => void;
  }

  const ForceGraph3D: ComponentType<ForceGraph3DProps>;

  export default ForceGraph3D;
}

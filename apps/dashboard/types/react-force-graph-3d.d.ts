declare module "react-force-graph-3d" {
  import type { ComponentType, ReactNode, MutableRefObject } from "react";
  import type { Object3D, Scene, WebGLRenderer } from "three";

  export interface ForceGraph3DProps {
    ref?: MutableRefObject<ForceGraph3DInstance | undefined>;
    graphData?: {
      nodes?: unknown[];
      links?: unknown[];
    };
    backgroundColor?: string;
    showNavInfo?: boolean;
    nodeId?: string;
    nodeLabel?: string | ((node: unknown) => ReactNode);
    linkLabel?: string | ((link: unknown) => ReactNode);
    nodeRelSize?: number;
    nodeVal?: number | ((node: unknown) => number);
    nodeOpacity?: number | ((node: unknown) => number);
    linkOpacity?: number | ((link: unknown) => number);
    nodeColor?: string | ((node: unknown) => string);
    nodeThreeObject?: ((node: unknown) => Object3D);
    nodeThreeObjectExtend?: boolean | ((node: unknown) => boolean);
    linkColor?: string | ((link: unknown) => string);
    linkWidth?: number | ((link: unknown) => number);
    linkCurvature?: number | ((link: unknown) => number);
    linkCurveRotation?: number | ((link: unknown) => number);
    linkDirectionalParticles?: number | ((link: unknown) => number);
    linkDirectionalParticleWidth?: number | ((link: unknown) => number);
    linkDirectionalParticleSpeed?: number | ((link: unknown) => number);
    linkDirectionalParticleColor?: string | ((link: unknown) => string);
    linkDirectionalArrowLength?: number | ((link: unknown) => number);
    linkDirectionalArrowColor?: string | ((link: unknown) => string);
    linkDirectionalArrowRelPos?: number | ((link: unknown) => number);
    enableNodeDrag?: boolean;
    enableNavigationControls?: boolean;
    onNodeClick?: (node: unknown) => void;
    onNodeHover?: (node: unknown | null, prevNode: unknown | null) => void;
    onBackgroundClick?: () => void;
    onEngineTick?: () => void;
    onEngineStop?: () => void;
    warmupTicks?: number;
    cooldownTicks?: number;
    cooldownTime?: number;
    d3AlphaDecay?: number;
    d3VelocityDecay?: number;
    width?: number;
    height?: number;
  }

  export interface ForceGraph3DInstance {
    cameraPosition: (
      position?: { x: number; y: number; z: number },
      lookAt?: { x: number; y: number; z: number },
      transitionMs?: number,
    ) => { x: number; y: number; z: number };
    scene: () => Scene;
    renderer: () => WebGLRenderer;
    refresh: () => void;
    d3Force: (forceName: string, force?: unknown) => unknown;
    d3ReheatSimulation: () => void;
  }

  const ForceGraph3D: ComponentType<ForceGraph3DProps>;

  export default ForceGraph3D;
}

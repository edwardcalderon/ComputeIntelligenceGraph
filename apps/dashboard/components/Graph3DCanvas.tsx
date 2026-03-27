"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import ForceGraph3D from "react-force-graph-3d";
import type { ForceGraph3DInstance } from "react-force-graph-3d";
import * as THREE from "three";
import type { Resource } from "../lib/api";
import { getProviderColor } from "../lib/providers";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Visual Config ────────────────────────────────────────────────────────────

const TYPE_GLOW: Record<string, string> = {
  compute: "#00e5ff",
  storage: "#00e676",
  network: "#d500f9",
  database: "#ff6d00",
  service: "#00b0ff",
};

function getGlowColor(type: string): string {
  return TYPE_GLOW[type.toLowerCase()] ?? "#90a4ae";
}

function buildGeometry(type: string): THREE.BufferGeometry {
  switch (type.toLowerCase()) {
    case "compute":
      return new THREE.IcosahedronGeometry(5, 1);
    case "storage":
      return new THREE.BoxGeometry(7, 7, 7);
    case "network":
      return new THREE.OctahedronGeometry(6, 0);
    case "database":
      return new THREE.CylinderGeometry(4.5, 4.5, 7, 12);
    case "service":
      return new THREE.TorusGeometry(4.5, 1.8, 12, 32);
    default:
      return new THREE.SphereGeometry(5, 24, 24);
  }
}

// ─── Sprite helpers ───────────────────────────────────────────────────────────

function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = 28;
  canvas.width = 512;
  canvas.height = 64;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  const label = text.length > 24 ? text.slice(0, 22) + "…" : text;
  ctx.fillText(label, 256, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(28, 3.5, 1);
  sprite.position.set(0, 10, 0);
  return sprite;
}

function createGlowSprite(color: string, size: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 128;
  canvas.height = 128;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color + "aa");
  gradient.addColorStop(0.4, color + "44");
  gradient.addColorStop(1, color + "00");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

// ─── Star field ───────────────────────────────────────────────────────────────

function createStarField(): THREE.Points {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const spread = 4000;

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    const brightness = 0.3 + Math.random() * 0.7;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness * (0.8 + Math.random() * 0.2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "cig-starfield";
  return points;
}

// ─── Node object factory ──────────────────────────────────────────────────────

function buildNodeObject(node: Graph3DNode): THREE.Group {
  const group = new THREE.Group();
  const resource = node.resource;
  const providerColor = getProviderColor(resource.provider);
  const glowColor = getGlowColor(resource.type);

  // Core geometry
  const geometry = buildGeometry(resource.type);
  const material = new THREE.MeshPhongMaterial({
    color: new THREE.Color(providerColor),
    emissive: new THREE.Color(glowColor),
    emissiveIntensity: node.highlighted ? 0.9 : 0.35,
    shininess: 80,
    transparent: true,
    opacity: node.dimmed ? 0.15 : 0.92,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "core";
  group.add(mesh);

  // Wireframe overlay
  const wireGeo = buildGeometry(resource.type);
  const wireMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(glowColor),
    wireframe: true,
    transparent: true,
    opacity: node.dimmed ? 0.04 : node.highlighted ? 0.5 : 0.18,
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  wire.scale.setScalar(1.15);
  wire.name = "wireframe";
  group.add(wire);

  // Outer glow sprite
  if (!node.dimmed) {
    const glow = createGlowSprite(
      node.highlighted ? "#fbbf24" : glowColor,
      node.highlighted ? 32 : 22,
    );
    glow.name = "glow";
    group.add(glow);
  }

  // Highlight ring
  if (node.highlighted) {
    const ringGeo = new THREE.RingGeometry(7, 8.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#fbbf24"),
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.name = "ring";
    group.add(ring);
  }

  // Text label
  if (!node.dimmed) {
    const label = resource.name || resource.id;
    const textColor = node.highlighted ? "#fde68a" : "#e2e8f0";
    const sprite = createTextSprite(label, textColor);
    group.add(sprite);
  }

  // Store metadata for animation
  group.userData = {
    nodeId: node.id,
    baseScale: 1,
    pulsePhase: Math.random() * Math.PI * 2,
    isHighlighted: node.highlighted,
    isDimmed: node.dimmed,
  };

  return group;
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const fgRef = useRef<ForceGraph3DInstance>();
  const starsAdded = useRef(false);
  const orbitAngle = useRef(0);
  const lastInteraction = useRef(Date.now());

  const graphData = useMemo(
    () => ({ nodes, links }),
    [links, nodes],
  );

  const handleNodeClick = useCallback(
    (node: unknown) => {
      const graphNode = node as Graph3DNode;
      lastInteraction.current = Date.now();
      onNodeClick(graphNode.id);

      // Fly camera toward clicked node
      const fg = fgRef.current;
      if (fg) {
        const n = node as { x?: number; y?: number; z?: number };
        if (n.x != null && n.y != null && n.z != null) {
          const dist = 120;
          fg.cameraPosition(
            { x: n.x, y: n.y + dist * 0.3, z: n.z + dist },
            { x: n.x, y: n.y, z: n.z },
            800,
          );
        }
      }
    },
    [onNodeClick],
  );

  const handleBackgroundClick = useCallback(() => {
    lastInteraction.current = Date.now();
  }, []);

  const nodeThreeObject = useCallback(
    (node: unknown) => buildNodeObject(node as Graph3DNode),
    [],
  );

  // Add star field + ambient light to scene once
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || starsAdded.current) return;

    const scene = fg.scene();
    if (!scene) return;

    starsAdded.current = true;
    scene.add(createStarField());

    // Ambient lighting for Phong materials
    const ambient = new THREE.AmbientLight(0x404060, 1.2);
    ambient.name = "cig-ambient";
    scene.add(ambient);

    const point = new THREE.PointLight(0x88ccff, 1.5, 2000);
    point.position.set(200, 300, 400);
    point.name = "cig-key-light";
    scene.add(point);

    const fill = new THREE.PointLight(0xff8844, 0.6, 2000);
    fill.position.set(-300, -100, -200);
    fill.name = "cig-fill-light";
    scene.add(fill);
  });

  // Camera auto-orbit + node pulse animation
  const handleEngineTick = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const scene = fg.scene();
    const now = Date.now();
    const timeSec = now / 1000;

    // Pulse animation for all node groups
    scene.traverse((obj: THREE.Object3D) => {
      if (obj.userData?.nodeId && obj instanceof THREE.Group) {
        const phase = obj.userData.pulsePhase as number;
        const isHighlighted = obj.userData.isHighlighted as boolean;
        const breathe = isHighlighted
          ? 1 + Math.sin(timeSec * 3 + phase) * 0.08
          : 1 + Math.sin(timeSec * 1.5 + phase) * 0.03;

        const core = obj.getObjectByName("core");
        if (core) core.scale.setScalar(breathe);

        const wireframe = obj.getObjectByName("wireframe");
        if (wireframe) {
          wireframe.rotation.y += isHighlighted ? 0.012 : 0.004;
          wireframe.rotation.x += 0.002;
        }

        const ring = obj.getObjectByName("ring");
        if (ring) {
          ring.rotation.x = Math.sin(timeSec * 2 + phase) * 0.5;
          ring.rotation.z += 0.02;
        }
      }
    });

    // Auto-orbit camera when idle (>4 seconds since last interaction)
    const idleMs = now - lastInteraction.current;
    if (idleMs > 4000) {
      orbitAngle.current += 0.002;
      const radius = 350;
      const camPos = fg.cameraPosition();
      fg.cameraPosition(
        {
          x: radius * Math.sin(orbitAngle.current),
          y: camPos.y * 0.998 + 50 * 0.002, // gently drift up
          z: radius * Math.cos(orbitAngle.current),
        },
        { x: 0, y: 0, z: 0 },
      );
    }
  }, []);

  // Track mouse interaction to pause orbit
  useEffect(() => {
    const handleInteraction = () => {
      lastInteraction.current = Date.now();
    };
    window.addEventListener("mousedown", handleInteraction);
    window.addEventListener("wheel", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    return () => {
      window.removeEventListener("mousedown", handleInteraction);
      window.removeEventListener("wheel", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950 shadow-[0_0_80px_rgba(6,182,212,0.08),0_20px_60px_rgba(0,0,0,0.5)] ring-1 ring-cyan-400/10">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeId="id"
        nodeLabel={(node: unknown) => {
          const resource = (node as Graph3DNode).resource;
          return `<div style="background:rgba(15,23,42,0.92);border:1px solid rgba(6,182,212,0.3);border-radius:8px;padding:6px 10px;font:12px Inter,system-ui,sans-serif;color:#e2e8f0;backdrop-filter:blur(8px)">
            <b style="color:#67e8f9">${resource.name || resource.id}</b><br/>
            <span style="color:#94a3b8;font-size:10px">${resource.type} · ${resource.provider}${resource.region ? ` · ${resource.region}` : ""}</span>
          </div>`;
        }}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkLabel={(link: unknown) => (link as Graph3DLink).label}
        linkColor={(link: unknown) => {
          const l = link as Graph3DLink;
          if (l.dimmed) return "rgba(100,116,139,0.06)";
          if (l.highlighted) return "#fbbf24";
          return l.color;
        }}
        linkWidth={(link: unknown) => {
          const l = link as Graph3DLink;
          return l.highlighted ? 2.5 : l.dimmed ? 0.3 : 0.8;
        }}
        linkCurvature={0.15}
        linkCurveRotation={(link: unknown) => {
          const l = link as Graph3DLink;
          // Deterministic rotation based on link id hash
          let hash = 0;
          for (let i = 0; i < l.id.length; i++) hash = ((hash << 5) - hash + l.id.charCodeAt(i)) | 0;
          return (hash % 628) / 100;
        }}
        linkDirectionalParticles={(link: unknown) => {
          const l = link as Graph3DLink;
          return l.dimmed ? 0 : l.highlighted ? 6 : 2;
        }}
        linkDirectionalParticleWidth={(link: unknown) => ((link as Graph3DLink).highlighted ? 3 : 1.5)}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleColor={(link: unknown) => {
          const l = link as Graph3DLink;
          if (l.highlighted) return "#fde68a";
          return l.color;
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowColor={(link: unknown) => {
          const l = link as Graph3DLink;
          if (l.dimmed) return "rgba(100,116,139,0.08)";
          return l.highlighted ? "#fbbf24" : l.color;
        }}
        linkDirectionalArrowRelPos={1}
        linkOpacity={0.7}
        enableNodeDrag
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        onEngineTick={handleEngineTick}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={60}
        cooldownTicks={100}
      />

      {/* HUD overlays */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/60 to-transparent" />

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
        <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)] backdrop-blur">
          3D force graph
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-600/30 bg-slate-800/60 px-2.5 py-1 text-[10px] text-slate-400 backdrop-blur">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {nodes.length} nodes · {links.length} edges
        </div>
      </div>

      {selectedId ? (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.15)] backdrop-blur">
          Selected
        </div>
      ) : null}

      {/* Legend */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1 rounded-xl border border-slate-700/40 bg-slate-900/70 px-3 py-2.5 text-[10px] backdrop-blur-sm">
        <span className="mb-1 font-semibold uppercase tracking-[0.2em] text-slate-500">Resource types</span>
        {Object.entries(TYPE_GLOW).map(([type, color]) => (
          <span key={type} className="flex items-center gap-2 text-slate-400">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: color, boxShadow: `0 0 6px ${color}` }}
            />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}

export default memo(Graph3DCanvas);

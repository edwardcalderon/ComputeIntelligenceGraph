import React, { useState, useEffect, useRef } from 'react';
import styles from './styles.module.css';

interface OrbitalNode {
  id: number;
  title: string;
  description: string;
  category: string;
  relatedIds: number[];
  status: 'stable' | 'active' | 'beta';
  energy: number;
  icon: string;
}

const CIG_NODES: OrbitalNode[] = [
  {
    id: 1,
    title: 'Getting Started',
    description: 'Install CIG and run your first intelligence graph in minutes. Covers prerequisites, CLI setup, and quick-start examples.',
    category: 'Onboarding',
    relatedIds: [2, 5],
    status: 'stable',
    energy: 95,
    icon: '🚀',
  },
  {
    id: 2,
    title: 'Architecture',
    description: 'Deep dive into the CIG system design — nodes, edges, inference engine, and the distributed graph runtime.',
    category: 'Core',
    relatedIds: [1, 3, 4],
    status: 'stable',
    energy: 90,
    icon: '🏗️',
  },
  {
    id: 3,
    title: 'API Reference',
    description: 'Complete REST and GraphQL API documentation with request/response schemas, auth flows, and code examples.',
    category: 'Reference',
    relatedIds: [2, 6],
    status: 'stable',
    energy: 88,
    icon: '⚡',
  },
  {
    id: 4,
    title: 'User Guide',
    description: 'Step-by-step tutorials for building intelligence graphs, managing datasets, and visualising results.',
    category: 'Guide',
    relatedIds: [2, 5],
    status: 'stable',
    energy: 85,
    icon: '📖',
  },
  {
    id: 5,
    title: 'Developer Guide',
    description: 'Contribution guidelines, local dev setup, coding standards, testing procedures, and release workflow.',
    category: 'Dev',
    relatedIds: [1, 4, 7],
    status: 'active',
    energy: 80,
    icon: '🛠️',
  },
  {
    id: 6,
    title: 'Troubleshooting',
    description: 'Common errors, debugging tips, and support channels to get you unblocked fast.',
    category: 'Support',
    relatedIds: [3, 7],
    status: 'stable',
    energy: 75,
    icon: '🔧',
  },
  {
    id: 7,
    title: 'Changelog',
    description: 'Full release history with breaking changes, new features, and bug fixes across all CIG versions.',
    category: 'Meta',
    relatedIds: [5, 6],
    status: 'active',
    energy: 70,
    icon: '📋',
  },
  {
    id: 8,
    title: 'FAQ',
    description: 'Answers to the most frequently asked questions about CIG concepts, pricing, and integrations.',
    category: 'Support',
    relatedIds: [1, 4],
    status: 'stable',
    energy: 72,
    icon: '💡',
  },
];

const STATUS_COLORS: Record<OrbitalNode['status'], string> = {
  stable: '#25c2a0',
  active: '#7c3aed',
  beta: '#f59e0b',
};

export default function OrbitalTimeline(): React.ReactElement {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulsingIds, setPulsingIds] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-rotation
  useEffect(() => {
    if (!autoRotate) return;
    const timer = setInterval(() => {
      setRotationAngle(prev => Number(((prev + 0.25) % 360).toFixed(3)));
    }, 50);
    return () => clearInterval(timer);
  }, [autoRotate]);

  const toggleNode = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setAutoRotate(true);
      setPulsingIds(new Set());
    } else {
      setExpandedId(id);
      setAutoRotate(false);
      const node = CIG_NODES.find(n => n.id === id);
      setPulsingIds(new Set(node?.relatedIds ?? []));
      // Snap rotation so selected node faces front (270°)
      const idx = CIG_NODES.findIndex(n => n.id === id);
      const targetAngle = (idx / CIG_NODES.length) * 360;
      setRotationAngle(270 - targetAngle);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setExpandedId(null);
      setAutoRotate(true);
      setPulsingIds(new Set());
    }
  };

  const getPosition = (index: number) => {
    const angle = ((index / CIG_NODES.length) * 360 + rotationAngle) % 360;
    const rad = (angle * Math.PI) / 180;
    const radius = 210;
    const x = radius * Math.cos(rad);
    const y = radius * Math.sin(rad);
    const depth = Math.cos(rad); // -1 (back) to 1 (front)
    const zIndex = Math.round(100 + 50 * depth);
    const opacity = Math.max(0.35, 0.35 + 0.65 * ((1 + depth) / 2));
    const scale = Math.max(0.75, 0.75 + 0.25 * ((1 + depth) / 2));
    return { x, y, zIndex, opacity, scale };
  };

  const expandedNode = CIG_NODES.find(n => n.id === expandedId) ?? null;
  void expandedNode; // reserved for future use

  return (
    <div className={styles.wrapper} ref={containerRef} onClick={handleBackdropClick}>
      {/* Orbit ring */}
      <div className={styles.orbitRing} />

      {/* Centre core */}
      <div className={styles.core}>
        <div className={styles.corePing} />
        <div className={styles.corePing2} />
        <span className={styles.coreLogo}>CIG</span>
      </div>

      {/* Nodes */}
      {CIG_NODES.map((node, index) => {
        const pos = getPosition(index);
        const isExpanded = expandedId === node.id;
        const isPulsing = pulsingIds.has(node.id);
        const color = STATUS_COLORS[node.status];

        return (
          <div
            key={node.id}
            className={styles.nodeWrapper}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              zIndex: isExpanded ? 300 : pos.zIndex,
              opacity: isExpanded ? 1 : pos.opacity,
            }}
            onClick={e => { e.stopPropagation(); toggleNode(node.id); }}
          >
            {/* Glow aura */}
            <div
              className={`${styles.aura} ${isPulsing ? styles.auraPulse : ''}`}
              style={{
                width: node.energy * 0.4 + 36,
                height: node.energy * 0.4 + 36,
                background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
              }}
            />

            {/* Icon button */}
            <div
              className={`${styles.nodeBtn} ${isExpanded ? styles.nodeBtnActive : ''}`}
              style={{
                borderColor: isExpanded ? color : `${color}66`,
                boxShadow: isExpanded ? `0 0 16px ${color}88` : 'none',
                transform: `scale(${isExpanded ? 1.4 : pos.scale})`,
              }}
            >
              <span className={styles.nodeIcon}>{node.icon}</span>
            </div>

            {/* Label */}
            <div
              className={styles.nodeLabel}
              style={{ color: isExpanded ? '#fff' : 'rgba(255,255,255,0.65)' }}
            >
              {node.title}
            </div>

            {/* Expanded card */}
            {isExpanded && (
              <div className={styles.card} onClick={e => e.stopPropagation()}>
                <div className={styles.cardConnector} />
                <div className={styles.cardHeader}>
                  <span className={styles.cardCategory}>{node.category}</span>
                  <span
                    className={styles.cardStatus}
                    style={{ background: color }}
                  >
                    {node.status.toUpperCase()}
                  </span>
                </div>
                <div className={styles.cardTitle}>{node.icon} {node.title}</div>
                <p className={styles.cardDesc}>{node.description}</p>

                {/* Energy bar */}
                <div className={styles.energyRow}>
                  <span>⚡ Completeness</span>
                  <span>{node.energy}%</span>
                </div>
                <div className={styles.energyTrack}>
                  <div
                    className={styles.energyFill}
                    style={{ width: `${node.energy}%`, background: `linear-gradient(90deg, #7c3aed, ${color})` }}
                  />
                </div>

                {/* Related nodes */}
                {node.relatedIds.length > 0 && (
                  <div className={styles.related}>
                    <div className={styles.relatedLabel}>🔗 Connected</div>
                    <div className={styles.relatedBtns}>
                      {node.relatedIds.map(rid => {
                        const rel = CIG_NODES.find(n => n.id === rid);
                        return (
                          <button
                            key={rid}
                            className={styles.relatedBtn}
                            onClick={e => { e.stopPropagation(); toggleNode(rid); }}
                          >
                            {rel?.icon} {rel?.title} →
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <a
                  className={styles.cardCta}
                  href={`/documentation/docs/en/${node.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  Read docs →
                </a>
              </div>
            )}
          </div>
        );
      })}

      {/* Hint */}
      {!expandedId && (
        <div className={styles.hint}>Click any node to explore</div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useRef } from "react";

/* ─── Types ───────────────────────────────────────────────────────────── */

export interface GraphParticleTypographyProps {
  className?: string;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  particleSize?: number;
  particleDensity?: number;
  dispersionStrength?: number;
  returnSpeed?: number;
  color?: string;
  /** Max distance between particles to draw an edge */
  connectionDistance?: number;
  /** Opacity of edges at zero-distance (fades with distance) */
  connectionOpacity?: number;
}

/* ─── Particle ────────────────────────────────────────────────────────── */

class Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  dispersion: number;
  returnSpd: number;

  constructor(
    x: number,
    y: number,
    size: number,
    color: string,
    dispersion: number,
    returnSpd: number
  ) {
    this.x = x + (Math.random() - 0.5) * 10;
    this.y = y + (Math.random() - 0.5) * 10;
    this.originX = x;
    this.originY = y;
    this.vx = (Math.random() - 0.5) * 5;
    this.vy = (Math.random() - 0.5) * 5;
    this.size = size;
    this.color = color;
    this.dispersion = dispersion;
    this.returnSpd = returnSpd;
  }

  update(mouseX: number, mouseY: number) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const interactionRadius = 120;

    if (distance < interactionRadius && mouseX !== -1000 && mouseY !== -1000) {
      const forceDirectionX = dx / distance;
      const forceDirectionY = dy / distance;
      const force = (interactionRadius - distance) / interactionRadius;

      this.vx -= forceDirectionX * force * this.dispersion;
      this.vy -= forceDirectionY * force * this.dispersion;
    }

    this.vx += (this.originX - this.x) * this.returnSpd;
    this.vy += (this.originY - this.y) * this.returnSpd;

    this.vx *= 0.85;
    this.vy *= 0.85;

    const distToOrigin = Math.sqrt(
      (this.x - this.originX) ** 2 + (this.y - this.originY) ** 2
    );

    // subtle idle jitter
    if (distToOrigin < 1 && Math.random() > 0.95) {
      this.vx += (Math.random() - 0.5) * 0.2;
      this.vy += (Math.random() - 0.5) * 0.2;
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ─── Component ───────────────────────────────────────────────────────── */

export function GraphParticleTypography({
  className,
  text,
  fontSize = 120,
  fontFamily = "Inter, sans-serif",
  particleSize = 1.8,
  particleDensity = 5,
  dispersionStrength = 15,
  returnSpeed = 0.08,
  color,
  connectionDistance = 18,
  connectionOpacity = 0.35,
}: GraphParticleTypographyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    let mouseX = -1000;
    let mouseY = -1000;

    let containerWidth = 0;
    let containerHeight = 0;

    /* ── Build a spatial grid for fast neighbour lookups ── */
    function drawConnections(
      ctx: CanvasRenderingContext2D,
      particles: Particle[],
      maxDist: number,
      baseOpacity: number,
      edgeColor: string
    ) {
      const cellSize = maxDist;
      const grid = new Map<string, Particle[]>();

      for (const p of particles) {
        const cx = Math.floor(p.x / cellSize);
        const cy = Math.floor(p.y / cellSize);
        const key = `${cx},${cy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(p);
      }

      ctx.lineWidth = 0.6;

      for (const [key, cell] of grid) {
        const [cx, cy] = key.split(",").map(Number);

        // check this cell + 4 neighbours (right, bottom, bottom-right, bottom-left)
        const neighbourKeys = [
          key,
          `${cx + 1},${cy}`,
          `${cx},${cy + 1}`,
          `${cx + 1},${cy + 1}`,
          `${cx - 1},${cy + 1}`,
        ];

        for (const nk of neighbourKeys) {
          const neighbour = grid.get(nk);
          if (!neighbour) continue;

          for (const a of cell) {
            for (const b of neighbour) {
              if (a === b) continue;
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < maxDist) {
                const opacity = baseOpacity * (1 - dist / maxDist);
                ctx.strokeStyle = edgeColor.replace("ALPHA", opacity.toFixed(3));
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        }
      }
    }

    const init = () => {
      const container = containerRef.current;
      if (!container) return;

      containerWidth = container.clientWidth;
      containerHeight = container.clientHeight;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = containerWidth * dpr;
      canvas.height = containerHeight * dpr;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      const computedStyle = window.getComputedStyle(container);
      const textColor = color || computedStyle.color || "#22d3ee"; // cyan-400 fallback

      ctx.clearRect(0, 0, containerWidth, containerHeight);

      const effectiveFontSize = Math.min(fontSize, containerWidth * 0.25);
      ctx.fillStyle = textColor;
      ctx.font = `900 ${effectiveFontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(text, containerWidth / 2, containerHeight / 2);

      const textCoordinates = ctx.getImageData(0, 0, canvas.width, canvas.height);

      particles = [];
      const step = Math.max(1, Math.floor(particleDensity * dpr));

      for (let y = 0; y < textCoordinates.height; y += step) {
        for (let x = 0; x < textCoordinates.width; x += step) {
          const index = (y * textCoordinates.width + x) * 4;
          const alpha = textCoordinates.data[index + 3] || 0;

          if (alpha > 128) {
            particles.push(
              new Particle(
                x / dpr,
                y / dpr,
                particleSize,
                textColor,
                dispersionStrength,
                returnSpeed
              )
            );
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, containerWidth, containerHeight);

      // Draw graph edges first (behind particles)
      const edgeColorTemplate = `rgba(34,211,238,ALPHA)`; // cyan-400
      drawConnections(ctx, particles, connectionDistance, connectionOpacity, edgeColorTemplate);

      // Draw particles on top
      for (const particle of particles) {
        particle.update(mouseX, mouseY);
        particle.draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      mouseX = touch.clientX - rect.left;
      mouseY = touch.clientY - rect.top;
    };

    const handleLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    const timeoutId = setTimeout(() => {
      init();
      animate();
    }, 150);

    const resizeObserver = new ResizeObserver(() => init());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleLeave);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleLeave);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleLeave);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    text,
    fontSize,
    fontFamily,
    particleSize,
    particleDensity,
    dispersionStrength,
    returnSpeed,
    color,
    connectionDistance,
    connectionOpacity,
  ]);

  return (
    <div
      ref={containerRef}
      className={[
        "w-full flex items-center justify-center relative touch-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

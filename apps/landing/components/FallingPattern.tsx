"use client";

import React from "react";

type FallingPatternProps = {
  color?: string;
  backgroundColor?: string;
  duration?: number;
  blurIntensity?: string;
  density?: number;
  className?: string;
};

export function FallingPattern({
  color = "rgba(6,182,212,0.35)",
  backgroundColor = "transparent",
  duration = 150,
  blurIntensity = "1em",
  density = 1,
  className = "",
}: FallingPatternProps) {
  const patterns = [
    `radial-gradient(4px 100px at 0px 235px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 235px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 117.5px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 252px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 252px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 126px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 150px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 150px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 75px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 253px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 253px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 126.5px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 204px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 204px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 102px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 134px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 134px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 67px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 179px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 179px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 89.5px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 299px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 299px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 149.5px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 215px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 215px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 107.5px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 281px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 281px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 140.5px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 158px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 158px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 79px, ${color} 100%, transparent 150%)`,
    `radial-gradient(4px 100px at 0px 210px, ${color}, transparent)`,
    `radial-gradient(4px 100px at 300px 210px, ${color}, transparent)`,
    `radial-gradient(1.5px 1.5px at 150px 105px, ${color} 100%, transparent 150%)`,
  ].join(", ");

  const backgroundSize = [
    "300px 235px", "300px 235px", "300px 235px",
    "300px 252px", "300px 252px", "300px 252px",
    "300px 150px", "300px 150px", "300px 150px",
    "300px 253px", "300px 253px", "300px 253px",
    "300px 204px", "300px 204px", "300px 204px",
    "300px 134px", "300px 134px", "300px 134px",
    "300px 179px", "300px 179px", "300px 179px",
    "300px 299px", "300px 299px", "300px 299px",
    "300px 215px", "300px 215px", "300px 215px",
    "300px 281px", "300px 281px", "300px 281px",
    "300px 158px", "300px 158px", "300px 158px",
    "300px 210px", "300px 210px", "300px 210px",
  ].join(", ");

  const dotFill = backgroundColor === "transparent" ? "rgba(255,255,255,0.92)" : backgroundColor;

  return (
    <div className={`relative size-full ${className}`}>
      {/* Falling lines layer — blur applied here, not via backdropFilter */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor,
          backgroundImage: patterns,
          backgroundSize,
          filter: `blur(${blurIntensity})`,
          animation: `falling-pattern ${duration}s linear infinite`,
        }}
      />
      {/* Dot-mask overlay: punches subtle holes to reveal blurred lines only */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent 1.5px, ${dotFill} 1.5px)`,
          backgroundSize: `${12 * density}px ${12 * density}px`,
          opacity: 0.95,
        }}
      />
    </div>
  );
}

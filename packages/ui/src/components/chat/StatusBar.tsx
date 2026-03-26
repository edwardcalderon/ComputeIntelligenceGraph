import React from "react";

/** CIGBot default gradient: red → amber → green */
const DEFAULT_GRADIENT =
  "linear-gradient(90deg,#E24B4A 0%,#EF9F27 45%,#1D9E75 78%)";

interface StatusBarProps {
  gradient?: string;
}

export function StatusBar({ gradient = DEFAULT_GRADIENT }: StatusBarProps) {
  return <div className="h-1 w-full" style={{ background: gradient }} />;
}

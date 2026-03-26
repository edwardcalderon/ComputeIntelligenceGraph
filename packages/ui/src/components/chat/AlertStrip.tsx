import React from "react";
import { StatusChip } from "./StatusChip";

interface AlertStripProps {
  critical?: number;
  attention?: number;
  /** When true (or when critical + attention are both 0), shows the "ok" chip */
  allOk?: boolean;
  label?: string;
}

/**
 * Dark navy strip that sits below the chat header bar.
 * Shows colored semaphore chips summarising active alert counts.
 */
export function AlertStrip({
  critical = 0,
  attention = 0,
  allOk = false,
  label = "Alertas",
}: AlertStripProps) {
  const showOk = allOk || (critical === 0 && attention === 0);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
      style={{ background: "#1a1a2e", borderBottom: "1px solid #2a2f3e" }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-wide flex-shrink-0"
        style={{ color: "#636b85" }}
      >
        {label}
      </span>
      <div className="flex gap-1.5 flex-1 justify-end flex-wrap">
        {critical > 0 && (
          <StatusChip
            variant="critical"
            label={`${critical} crítica${critical > 1 ? "s" : ""}`}
          />
        )}
        {attention > 0 && (
          <StatusChip variant="attention" label={`${attention} atención`} />
        )}
        {showOk && <StatusChip variant="ok" label="ok" />}
      </div>
    </div>
  );
}

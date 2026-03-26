import React from "react";
import { ChatCard } from "./ChatCard";
import { CardHeader } from "./CardHeader";
import { StarFeedback } from "./StarFeedback";
import type { TimelineEvent, TimelineEventType } from "./types";

const DOT_COLOR: Record<TimelineEventType, string> = {
  start:   "#6C3DE8",
  process: "#378ADD",
  error:   "#E24B4A",
  pending: "#EF9F27",
};

const TITLE_COLOR: Record<TimelineEventType, string> = {
  start:   "#3C3489",
  process: "#0C447C",
  error:   "#791F1F",
  pending: "#854F0B",
};

interface TimelineCardProps {
  title?: string;
  rightLabel?: string;
  events: TimelineEvent[];
  /** Red "Causa raíz:" summary box shown below the timeline */
  causeBox?: string;
  /** Purple KMS policy quote block shown below the timeline */
  kmsQuote?: string;
  showFeedback?: boolean;
  onRate?: (rating: number) => void;
}

/**
 * Causal traceability timeline card.
 * Each event has a colored dot (start=purple, process=blue, error=red, pending=amber).
 * Optional causeBox for root-cause summary and kmsQuote for policy citations.
 */
export function TimelineCard({
  title = "ERP · Trazabilidad",
  rightLabel = "Bloqueado",
  events,
  causeBox,
  kmsQuote,
  showFeedback = true,
  onRate,
}: TimelineCardProps) {
  const isBlocked = rightLabel?.toLowerCase() === "bloqueado";

  return (
    <ChatCard blocked={isBlocked}>
      <CardHeader
        variant={isBlocked ? "red" : "purple"}
        title={title}
        rightLabel={rightLabel}
      />
      <div className="px-3 py-2.5">
        {/* Timeline events */}
        <div className="flex flex-col">
          {events.map((ev, i) => {
            const isLast = i === events.length - 1;
            return (
              <div key={i} className="flex gap-2">
                {/* Dot + vertical connector */}
                <div className="flex w-4 flex-shrink-0 flex-col items-center">
                  <div
                    className="mt-0.5 size-2.5 flex-shrink-0 rounded-full"
                    style={{ background: DOT_COLOR[ev.type] }}
                  />
                  {!isLast && (
                    <div
                      className="mt-0.5 w-0.5 flex-1"
                      style={{ background: "#e8e4f8", minHeight: 8 }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2.5">
                  <p className="text-[8.5px]" style={{ color: "#888" }}>
                    {ev.time} · {ev.source}
                  </p>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: TITLE_COLOR[ev.type] }}
                  >
                    {ev.title}
                  </p>
                  <p
                    className="mt-0.5 text-[10px] leading-snug"
                    style={{ color: "#666" }}
                  >
                    {ev.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Root cause box */}
        {causeBox && (
          <div
            className="mt-1 rounded-md px-2 py-1.5 text-[10px] leading-snug"
            style={{ background: "#FCEBEB", color: "#791F1F" }}
          >
            <strong>Causa raíz:</strong> {causeBox}
          </div>
        )}

        {/* KMS policy citation */}
        {kmsQuote && (
          <div
            className="mt-2 rounded-r-lg py-1.5 pl-2 pr-2 text-[10px] italic leading-snug"
            style={{
              borderLeft: "3px solid #6C3DE8",
              background: "#EEEDFE",
              color: "#3C3489",
            }}
          >
            {kmsQuote}
          </div>
        )}
      </div>
      {showFeedback && (
        <StarFeedback variant={isBlocked ? "red" : "default"} onRate={onRate} />
      )}
    </ChatCard>
  );
}

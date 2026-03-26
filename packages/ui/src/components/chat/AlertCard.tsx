import React from "react";
import { ChatCard } from "./ChatCard";
import { CardHeader } from "./CardHeader";
import { StatusBar } from "./StatusBar";
import { AlertItem } from "./AlertItem";
import { SummaryBadges } from "./SummaryBadges";
import { StarFeedback } from "./StarFeedback";
import type { AlertItemData } from "./types";

interface AlertCardProps {
  title?: string;
  timestamp?: string;
  items: AlertItemData[];
  showSummary?: boolean;
  showFeedback?: boolean;
  onRate?: (rating: number) => void;
}

/**
 * Multi-module alert panel card — always the first card of the day.
 * Includes a severity gradient status bar, alert item rows, summary badges,
 * and optional star-rating footer.
 */
export function AlertCard({
  title = "Panel de alertas",
  timestamp = "Ahora",
  items,
  showSummary = true,
  showFeedback = true,
  onRate,
}: AlertCardProps) {
  const critical = items.filter((i) => i.severity === "critical").length;
  const attention = items.filter(
    (i) => i.severity === "attention" || i.severity === "partial"
  ).length;
  const ok = items.filter((i) => i.severity === "ok").length;

  return (
    <ChatCard>
      <StatusBar />
      <CardHeader title={title} rightLabel={timestamp} />
      <div className="px-3 py-2.5">
        {items.map((item, idx) => (
          <AlertItem key={idx} {...item} />
        ))}
        {showSummary && (
          <SummaryBadges critical={critical} attention={attention} ok={ok} />
        )}
      </div>
      {showFeedback && <StarFeedback onRate={onRate} />}
    </ChatCard>
  );
}
